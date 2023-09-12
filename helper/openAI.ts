import axios, { Message } from './axios'
import { Stream } from 'stream'
import 'dotenv/config'

class OpenAIWrapper {
  private createMessage = (msg: string) => ({ role: 'user', content: msg })
  private history: any[] = []

  constructor() {
    this.history = []
  }

  async prompt(msg: string, postMessageFn: (x: string) => void) {
    this.history.push(this.createMessage(msg))
    return this.askChatGPTStreamHandler([...this.history], postMessageFn)
  }

  async createConversationStream() {
    return async (message: string, postMessageFn: (x: string) => void) => {
      this.history.push(this.createMessage(message))
      const response = await this.askChatGPTStreamHandler([...this.history], postMessageFn)
      this.history.push(response)

      return response
    }
  }

  getData(line: string) {
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

  getStreamData(
    stream: Stream,
    chunkHandler: (x: string) => void
  ): Promise<{ content: string; role: string }> {
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
          const { content, role } = this.getData(line)

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

  pushStreamResponse(data: string, messageCallback: (message: string) => void) {
    const lines: string[] = data.split('\n').filter((line: string) => line.trim() !== '')
    try {
      for (const line of lines) {
        const { content, role } = this.getData(line)

        if (content) {
          messageCallback(content)
        }
      }
    } catch (e) {
      console.log(`🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ getStreamData ➡ line:`, data)
      console.log(`🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ getStreamData ➡ e:`, e)
    }
  }

  async askChatGPTStream(message: Message[]): Promise<Stream> {
    return new Promise(async (resolve) => {
      try {
        const request = {
          model: 'gpt-3.5-turbo',
          stream: true,
          messages: message,
        }

        const response = await axios.post('chat/completions', request, {
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

  async askChatGPTStreamHandler(
    code: Message[],
    postMessageFn: (x: string) => void,
    clear?: () => void
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const streamResponse = await this.askChatGPTStream(code)

        this.getStreamData(streamResponse, (data: string) =>
          this.pushStreamResponse(data, postMessageFn)
        )
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
}

export default OpenAIWrapper
