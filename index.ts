import OpenAIWrapper from './helper/openAI'
import { COLOR, MODEL } from './helper/constance'
import { spawn } from 'child_process'
import axios from 'axios'
import EnquirerWrapper from './helper/enquirer'
const rl2 = new EnquirerWrapper()

const ask = async (question: string): Promise<string> => {
  return rl2
    .getMultilineInput(`${COLOR.green}${question} ${COLOR.purple}`)
    .then((response) => response.trim())
}

const extractModelName = (input: string): string | null => {
  const regex = /\/([^\/]+)\/[^\/]+$/
  const match = input.match(regex)
  return match ? match[1] : null
}

const getLocalModel = async () => {
  const model = await axios.get('http://localhost:1234/v1/models').then(({ data }) => {
    return data.data.map((model: any) => [extractModelName(model.id) || model.id, model.id])
  }).catch(() => {
    console.error("LLM does not start")
    return []
  })

  return Object.fromEntries(model)
}

const selectModel = async (models: Record<string, string>): Promise<string> => {
  const choices = Object.keys(models)
  const selectedModel: string = await rl2.selectOptionFromList(
    `${COLOR.yellow}Select AI Model: ${COLOR.reset} `,
    choices
  )
  return selectedModel
}

enum SYMBOL {
  continueConversation = '&',
  systemMessage = '$',
  embeddedMessage = '@',
  selectModelCommand = '#',
  drawImage = '!',
  newConversation = ' ',
  newLine = `\n`,
}

const selectNextQuestion = async (): Promise<SYMBOL> => {
  const choices = [
    { name: 'Cont', value: SYMBOL.continueConversation },
    { name: 'New', value: SYMBOL.newConversation },
    { name: 'System', value: SYMBOL.systemMessage },
    { name: 'Select model', value: SYMBOL.selectModelCommand },
    { name: 'Exit', value: SYMBOL.newLine },
  ]

  const item: string = await rl2.selectOptionFromList(
    `${COLOR.yellow}Action: ${COLOR.reset} `,
    choices
  )
  const choice = choices.find((choice: any) => choice.name === item)
  return (choice !== undefined ? choice.value : choice) as SYMBOL
}

const showLoading = () => {
  const spinnerChars = ['-  ', '\\  ', '|  ', '/  ']

  let spinnerIndex = 0
  let isDestroyed = false

  const spinnerInterval = setInterval(() => {
    process.stdout.write('\r' + spinnerChars[spinnerIndex++])
    spinnerIndex %= spinnerChars.length
  }, 100)

  // call some asynchronous function
  return (destroy: boolean) => {
    if (!isDestroyed && !!destroy) {
      clearInterval(spinnerInterval)
      process.stdout.clearLine(0) // Clear the console/terminal line
      process.stdout.cursorTo(0)
      isDestroyed = destroy
    }
  }
}

// FIX: Safely handle data.usage
const display = (data: any) => {
  const { choices } = data
  const total_tokens = data?.usage?.total_tokens || 0

  console.log(`\n🙇 ${COLOR.magenta}${total_tokens} tokens used`)
  for (let { message } of choices || []) {
    const { content } = message
    console.log(`${COLOR.cyan}${content}${COLOR.reset}`)
  }
}

const displayResponse = (content: string) => {
  if (!content.includes('data:')) {
    process.stdout.write(`${COLOR.cyan}${content}${COLOR.reset}`)
  }
}

const displayImage = (url?: string) => {
  if (!url) return

  displayResponse(url)

  const imgCat = spawn('imgcat', [url], { stdio: 'inherit' })

  imgCat.on('error', (err) => {
    console.error(`Failed to start imgcat: ${err}`)
  })
}

const username = `Stiger`
const newQuestion: string = `${COLOR.yellow}Question: ${COLOR.reset}\n`

;(async () => {
  try {
    const localModel = await getLocalModel()
    const ALL_MODEL = { ...localModel, ...MODEL }

    console.log(`\n🫡   Hello ${COLOR.cyan}${username}${COLOR.reset}`)
    let model = await selectModel(ALL_MODEL)

    // @ts-ignore
    let helper = new OpenAIWrapper(ALL_MODEL[model])

    let _systemMessage = ''

    let question: any = await ask(newQuestion)

    while (!!question && question !== '\n') {
      let firstChar = question[0]
      const isNewQuestion = firstChar !== SYMBOL.continueConversation
      const isSystemMessage = firstChar === SYMBOL.systemMessage

      if (isSystemMessage) {
        _systemMessage = question.replace(SYMBOL.systemMessage, '').trim()
      }

      const closeLoadingFn = !isSystemMessage ? showLoading() : null

      if (firstChar === SYMBOL.selectModelCommand) {
        closeLoadingFn && closeLoadingFn(true)
        model = await selectModel(ALL_MODEL)

        // @ts-ignore
        helper.setModel(ALL_MODEL[model])
      } else {
        if (isNewQuestion) {
          // @ts-ignore
          helper = new OpenAIWrapper(ALL_MODEL[model], _systemMessage)
        } else {
          firstChar = question[1]
        }

        if (firstChar === SYMBOL.embeddedMessage) {
          try {
            const response = await helper.embed(question.replace(SYMBOL.embeddedMessage, ''))
            closeLoadingFn && closeLoadingFn(true)
            displayResponse(response)
          } catch (error) {
            closeLoadingFn && closeLoadingFn(true)
            displayResponse((error as any).message)
          }
        } else if (firstChar === SYMBOL.drawImage) {
          try {
            const [response] = await helper.drawImage(question.replace(SYMBOL.drawImage, ''))
            const { url, revised_prompt } = response
            displayResponse(revised_prompt)
            console.log()
            closeLoadingFn && closeLoadingFn(true)

            displayImage(url || '')
            console.log()
          } catch (error) {
            closeLoadingFn && closeLoadingFn(true)
            displayResponse((error as any).message)
          }
        } else if (!isSystemMessage) {
          await helper.prompt(
            question.replace(SYMBOL.continueConversation, ''),
            (message: string) => {
              closeLoadingFn && closeLoadingFn(true)
              displayResponse(message)
            },
            false
          )
        } else {
          closeLoadingFn && closeLoadingFn(true)
        }
      }

      console.log()
      const next = await selectNextQuestion()
      if ([SYMBOL.selectModelCommand, SYMBOL.newLine].includes(next)) {
        question = `${next?.trim()}`
      } else {
        const question2 = await ask(newQuestion)
        question = `${next?.trim()} ${question2}`
      }
    }
  } catch (error: any) {
    if (error.response) {
      console.log(error.response.status)
      console.log(error.response.data)
    } else {
      console.log(error.message)
    }
  }
})()

// displayImage(`https://pbs.twimg.com/media/GFBlqe6aQAAqufn?format=jpg&name=large`)
