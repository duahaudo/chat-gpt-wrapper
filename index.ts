import readline from 'readline'
import OpenAIWrapper from './helper/openAI'
import { COLOR, MODEL } from './helper/constance'
import { spawn } from 'child_process'
import axios from 'axios'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
})

const ask = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(`${COLOR.green}${question} `, (answer: string) => {
      resolve(answer)
    })
  })
}

const extractModelName = (input: string): string | null => {
  const regex = /\/([^\/]+)\/[^\/]+$/;
  const match = input.match(regex);
  return match ? match[1] : null;
}

const getLocalModel = async () => {
  const model = await axios.get('http://localhost:1234/v1/models').then(({ data }) => {
    return data.data.map((model: any) => ([
      extractModelName(model.id) || model.id, model.id
    ]))
  })

  return Object.fromEntries(model)
}

const selectModel = async () => {
  const question = `\n${COLOR.yellow}Select AI Model:${COLOR.reset}\n`

  const localModel = await getLocalModel()
  const choices = Object.keys({ ...MODEL, ...localModel })

  console.log(question)
  choices.forEach((choice, index) => {
    console.log(`${index + 1}. ${choice}`)
  })

  return new Promise((resolve) => {
    rl.question(
      `\n${COLOR.yellow}Please enter the number of your choice: ${COLOR.reset}(default: 1) `,
      (answer) => {
        const choiceIndex = answer === '' ? 0 : parseInt(answer) - 1
        if (choiceIndex >= 0 && choiceIndex < choices.length) {
          console.log(
            `\n${COLOR.yellow}Selected model: ${COLOR.cyan}${choices[choiceIndex]}${COLOR.reset}`
          )
          resolve(choices[choiceIndex])
        } else {
          resolve(selectModel())
        }
      }
    )
  })
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

const display = (data: any) => {
  const {
    choices,
    usage: { total_tokens },
  } = data

  console.log(`\n🙇 ${COLOR.magenta}${total_tokens} tokens used`)
  for (let { message } of choices) {
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

  const imgcat = spawn('imgcat', [url], { stdio: 'inherit' })

  imgcat.on('error', (err) => {
    console.error(`Failed to start imgcat: ${err}`)
  })

  // imgcat.on('exit', (code) => {
  //   console.log(`imgcat exited with code ${code}`);
  // });
}

enum SYMBOL {
  continueConversation = '&',
  systemMessage = '$',
  embeddedMessage = '@',
  gpt4Model = '#',
  drawImage = '!',
}

const username = `Stiger`
const newQuestion: string = `\n❓`

  ; (async () => {
    try {
      console.log(`\n🫡   Hello ${COLOR.cyan}${username}${COLOR.reset}`)
      let model = await selectModel()

      const localModel = await getLocalModel()
      const ALL_MODEL = Object.keys({ ...MODEL, ...localModel })

      // @ts-ignore
      let helper = new OpenAIWrapper(ALL_MODEL[model])

      // keep system message in memory
      let _systemMessage = ''

      let question: any = await ask(newQuestion)
      while (!!question) {
        // first character need to be `&` to continue conversation
        let firstChar = question[0]
        const isNewQuestion = firstChar !== SYMBOL.continueConversation
        const isSystemMessage = firstChar === SYMBOL.systemMessage

        if (isSystemMessage) {
          _systemMessage = question.replace(SYMBOL.systemMessage, '').trim()
        }

        const closeLoadingFn = !isSystemMessage ? showLoading() : null

        if (firstChar === SYMBOL.gpt4Model) {
          closeLoadingFn && closeLoadingFn(true)
          // select model again
          let model = await selectModel()

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

        // trick to keep console output
        console.log()
        question = await ask(newQuestion)
      }

      rl.close()
    } catch (error: any) {
      if (error.response) {
        console.log(error.response.status)
        console.log(error.response.data)
      } else {
        console.log(error.message)
      }
    }
  })()

// displayImage(`https://pbs.twimg.com/media/GFBlqe6aQAAqufn\?format\=jpg\&name\=large`)
