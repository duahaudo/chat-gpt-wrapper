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

// Function to display the image in the terminal
// @ts-ignore
function displayImage2(base64) {
  const imgcat = spawn('imgcat', ['-f'])
  imgcat.stdin.write(base64)
  imgcat.stdin.end()

  imgcat.stdout.on('data', (data) => {
    process.stdout.write(data)
  })

  imgcat.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`)
  })

  imgcat.on('close', (code) => {
    console.log(`imgcat process exited with code ${code}`)
  })
}

const displayImage = (url?: string) => {
  if (!url) return

  displayResponse(url)

  axios.get(url, { responseType: 'stream' }).then((response) => {
    const chunks: any = []
    response.data.on('data', (chunk: any) => {
      chunks.push(chunk)
    })
    response.data.on('end', () => {
      const buffer = Buffer.concat(chunks as any)
      const base64 = buffer.toString('base64')
      displayImage2(base64)
    })
  })
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

;(async () => {
  try {
    console.log(`\n🫡   Hello ${COLOR.cyan}${username}${COLOR.reset}`)

    let question: any = await ask(newQuestion)
    let helper = new OpenAIWrapper()

    while (!!question) {
      // first character need to be `&` to continue conversation
      let firstChar = question[0]
      const isNewQuestion = firstChar !== SYMBOL.continueConversation
      const isSystemMessage = firstChar === SYMBOL.systemMessage

      const closeLoadingFn = !isSystemMessage ? showLoading() : null

      if (isNewQuestion) {
        helper = new OpenAIWrapper()
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
          displayResponse(revised_prompt + '\n')
          closeLoadingFn && closeLoadingFn(true)

          displayResponse(url || '')
        } catch (error) {
          closeLoadingFn && closeLoadingFn(true)
          displayResponse((error as any).message)
        }
      } else {
        if (firstChar === SYMBOL.gpt4Model) {
          helper.setModel(MODEL['gpt-4'])
        } else {
          helper.setModel(MODEL['gpt-3.5-turbo'])
        }

        await helper.prompt(
          question.replace(SYMBOL.continueConversation, '').replace(SYMBOL.systemMessage, ''),
          (message: string) => {
            closeLoadingFn && closeLoadingFn(true)
            displayResponse(message)
          },
          isSystemMessage
        )
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
