import axios from 'axios'
import { Stream } from 'stream'
import 'dotenv/config'

interface Message {
  role: string
  content: string
}

const http = axios.create({
  baseURL: 'https://api.openai.com/v1/',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
})

const createMessage = (msg: string) => ({ role: 'user', content: msg })

export const createConversationStream = async () => {
  const history: any[] = []

  return async (message: string, postMessageFn: (x: string) => void) => {
    history.push(createMessage(message))
    const response = await askChatGPTStreamHandler([...history], postMessageFn)
    history.push(response)

    return response
  }
}

const getStreamData = (
  stream: Stream,
  chunkHandler: (x: string) => void
): Promise<{ content: string; role: string }> => {
  return new Promise((resolve, reject) => {
    const data: { content: string; role: string } = { content: '', role: '' }
    const lines: string[] = []

    stream.on('data', (chunk) => {
      const chunkString = chunk.toString()
      chunkHandler(chunkString)
      lines.push(...chunkString.split('\n'))
    })

    stream.on('end', () => {
      for (const line of lines) {
        const { content, role } = getData(line)

        if (role) {
          data.role = role
        }

        if (content) {
          data.content += content
        }
      }

      resolve(data)
    })

    stream.on('error', (err) => {
      reject(err)
    })
  })
}

const getData = (line: string) => {
  // console.log(`🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ getData ➡ line:`, line)
  if (!line.includes('data: [DONE]')) {
    const jsonString = line.substring(line.indexOf('{'), line.lastIndexOf('}') + 1)

    try {
      const message = JSON.parse(jsonString)
      const { choices } = message
      const { content, role } = choices[0].delta

      return { content, role }
    } catch {
      return { content: jsonString, role: 'user' }
    }
  }

  return {}
}

const pushStreamResponse = (data: string, messageCallback: (message: string) => void) => {
  const lines: string[] = data.split('\n').filter((line: string) => line.trim() !== '')
  try {
    for (const line of lines) {
      const { content, role } = getData(line)

      if (content) {
        messageCallback(content)
      }
    }
  } catch (e) {
    console.log(`🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ getStreamData ➡ line:`, data)
    console.log(`🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ getStreamData ➡ e:`, e)
  }
}

const askChatGPTStream = async (message: Message[]): Promise<Stream> => {
  return new Promise(async (resolve) => {
    try {
      const request = {
        model: 'gpt-3.5-turbo',
        stream: true,
        messages: message,
      }

      const response = await http.post('chat/completions', request, {
        timeout: 1000 * 60 * 2,
        responseType: 'stream',
      })

      resolve(response.data as Stream)
    } catch (error: any) {
      if (error.response) {
        console.log(error.response.status)
        console.log(error.response.data)
      } else {
        console.log(error.message)
      }
    }
  })
}

const askChatGPTStreamHandler = async (
  code: Message[],
  postMessageFn: (x: string) => void,
  clear?: () => void
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const streamResponse = await askChatGPTStream(code)

      getStreamData(streamResponse, (data: string) => pushStreamResponse(data, postMessageFn))
        .catch((err) => console.error(err))
        .then((data) => resolve(data))
      // .finally(() => clear())
    } catch (error: any) {
      if (error.response) {
        console.log(error.response.status)
        console.log(error.response.data)
      } else {
        console.log(error.message)
      }

      reject(error)
    }
  })
}
