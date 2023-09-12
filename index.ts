import readline from 'readline'
import OpenAIWrapper from './helper/openAI'

// Define the colors
enum COLOR {
  reset = '\x1b[0m',
  red = '\x1b[31m',
  green = '\x1b[32m',
  yellow = '\x1b[33m',
  blue = '\x1b[34m',
  magenta = '\u001b[35m',
  cyan = '\u001b[36m',
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

const ask = (question: string) => {
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
  process.stdout.write(`${COLOR.cyan}${content}${COLOR.reset}`)
}

const username = `Stiger`
const newQuestion: string = `\n❓`

;(async () => {
  try {
    console.log(`\n🫡   Hello ${COLOR.cyan}${username}${COLOR.reset}`)

    let question: any = await ask(newQuestion)
    let helper = new OpenAIWrapper()

    while (!!question) {
      // first character need to be `+` to continue conversation
      const firstChar = question[0]
      const isNewQuestion = firstChar !== '+'

      const closeLoadingFn = showLoading()

      if (isNewQuestion) {
        helper = new OpenAIWrapper()
      }
      await helper.prompt(isNewQuestion ? question.slice(1) : question, (message: string) => {
        closeLoadingFn(true)
        displayResponse(message)
      })

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
