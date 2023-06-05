import { Stream } from 'stream'

import 'dotenv/config'
import axios from 'axios'
import readline from 'readline'
import { createConversationStream } from './helper'

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

enum COMMAND {
  newChat = 'new',
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const http = axios.create({
  baseURL: 'https://api.openai.com/v1/',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
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

  const spinnerInterval = setInterval(() => {
    process.stdout.write('\r' + spinnerChars[spinnerIndex++])
    spinnerIndex %= spinnerChars.length
  }, 100)

  // call some asynchronous function
  return () => {
    clearInterval(spinnerInterval)
    process.stdout.clearLine(0) // Clear the console/terminal line
    process.stdout.cursorTo(0)
  }
}

interface Message {
  role: string
  content: string
}
const createMessage = (msg: string) => ({ role: 'user', content: msg })

const getContentFromResponse = (response: any) => {
  const { choices } = response as any
  const { content, role } = (choices as any)[0].message
  return { content, role }
}

const createConversation = async (firstMessage: string) => {
  const history: any[] = []

  const firstResponse = await askChatGPT([createMessage(firstMessage)])
  history.push(getContentFromResponse(firstResponse))

  return async (message: string) => {
    history.push(createMessage(message))
    const response = await askChatGPT([...history])
    history.push(getContentFromResponse(response))

    return response
  }
}

const askChatGPT = async (message: Message[]) => {
  return new Promise(async (resolve) => {
    const clear = showLoading()
    try {
      const request = {
        model: 'gpt-3.5-turbo',
        stream: false,
        messages: message,
      }

      const { data } = await http.post('chat/completions', request)
      clear()

      resolve(data)
    } catch (error: any) {
      if (error.response) {
        console.log(error.response.status)
        console.log(error.response.data)
      } else {
        console.log(error.message)
      }
      clear()
    }
  })
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

const display2 = () => {
  const source: string[] = []

  return (text: string) => {
    source.push(text)
    const content = source.shift() || ''
    process.stdout.write(`${COLOR.cyan}${content}${COLOR.reset}`)
  }
}

const username = `Stiger`
const newQuestion: string = `\n❓`

;(async () => {
  try {
    console.log(`\n🫡   Hello ${COLOR.cyan}${username}${COLOR.reset}`)

    let question: any = await ask(newQuestion)

    if (question) {
      let conversationFn = await createConversationStream()

      while (!!question) {
        const showMessage = display2()
        await conversationFn(question, showMessage)
        console.log()
        // console.log(`\n🙇 ${COLOR.magenta}100 tokens used${COLOR.reset}`)
        question = await ask(newQuestion)

        if (question === COMMAND.newChat) {
          question = await ask(newQuestion)
          conversationFn = await createConversationStream()
        }
      }
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
