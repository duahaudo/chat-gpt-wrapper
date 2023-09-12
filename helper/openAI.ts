import axios, { Message } from './axios'
import { Stream } from 'stream'
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'

class OpenAIWrapper {
  private createMessage = (msg: string) => ({ role: 'system', content: msg })
  private history: any[] = []

  constructor() {
    this.history = []
  }

  async prompt(msg: string, postMessageFn: (x: string) => void, isSystem?: boolean) {
    this.history.push(this.createMessage(msg))

    if (!isSystem) {
      return this.askChatGPTStreamHandler([...this.history], postMessageFn)
    }

    return Promise.resolve('')
  }

  getData(line: string) {
    if (!line.includes('data: [DONE]')) {
      const jsonString = line.substring(line.indexOf('{'), line.lastIndexOf('}') + 1)
      try {
        if (!jsonString) {
          return { content: '', role: 'assistant' }
        }

        const message = JSON.parse(jsonString)
        const { choices } = message
        const { content, role } = choices[0].delta

        return { content, role }
      } catch {
        // track log
        this.writeToErrorLog(jsonString)
        return { content: jsonString, role: 'assistant' }
      }
    }

    return {}
  }

  private async writeToErrorLog(jsonString: string) {
    try {
      const timestamp = new Date().toISOString() // Get current timestamp
      const logString = `${timestamp} ${jsonString}` // Prepend timestamp to JSON string

      await fs.appendFile(path.join('./error.log'), logString + '\n') // Append log string to error.log file
    } catch (error) {
      console.error('Error writing to error.log:', error)
    }
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

  async askChatGPTStream(messages: Message[]): Promise<Stream> {
    return new Promise(async (resolve) => {
      try {
        const request = {
          model: 'gpt-3.5-turbo',
          stream: true,
          messages,
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
