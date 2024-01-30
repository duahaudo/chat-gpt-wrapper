import 'dotenv/config'
import axios, { Message } from './axios'
import { Stream } from 'stream'
import fs from 'fs/promises'
import path from 'path'
import { getObject } from './getObject'
import { COLOR, IPhotoResponse, MODEL } from './constance'

class OpenAIWrapper {
  private createMessage = (msg: string, isSystem?: boolean) => ({
    role: isSystem ? 'system' : 'user',
    content: msg,
  })
  private history: any[] = []
  private _model: MODEL = MODEL['gpt-3.5-turbo']

  constructor() {
    this.history = []
  }

  public setModel(model: MODEL) {
    this._model = model
  }

  async drawImage(msg: string) {
    const message = this.createMessage(msg, false)
    this.history.push()
    return this.askDallEGenerate(message.content)
  }

  async prompt(msg: string, postMessageFn: (x: string) => void, isSystem?: boolean) {
    this.history.push(this.createMessage(msg, isSystem))
    return this.askChatGPTStreamHandler([...this.history], postMessageFn)
  }

  getData(line: string, originalMessage: string) {
    if (!line.includes('data: [DONE]')) {
      const jsonString = line.substring(line.indexOf('{'), line.lastIndexOf('}') + 1)
      try {
        if (!jsonString) {
          return { content: '', role: 'assistant' }
        }

        const message = getObject(line)
        const { choices, delta } = message
        // const choices = this.extractChoiceFromString(line)
        const { content, role } = delta || choices[0].delta

        return { content, role }
      } catch {
        // track log
        this.writeToErrorLog(`${originalMessage} \n ${line}`)
        return { content: jsonString, role: 'assistant' }
      }
    }

    return {}
  }

  extractChoiceFromString(inputString: string) {
    // Use regular expressions to find and extract the JSON data
    const match = inputString.match(/"choices":\[(.*?)\]/)

    if (match) {
      const jsonString = `{"choices":[${match[1]}]}`

      try {
        const data = JSON.parse(jsonString)
        if (Array.isArray(data.choices) && data.choices.length > 0) {
          return data.choices[0] // Assuming there's only one choice
        }
      } catch (error) {
        console.error('Error parsing JSON:', error)
      }
    }

    return null // JSON data not found or invalid structure
  }

  private async writeToErrorLog(jsonString: string) {
    try {
      const timestamp = new Date().toISOString() // Get current timestamp
      const logString = `${timestamp} ${jsonString}` // Prepend timestamp to JSON string

      await fs.appendFile(
        process.env.ERROR_LOG_FILE || path.resolve('./error.log'),
        logString + '\n'
      ) // Append log string to error.log file
    } catch (error) {
      console.error('Error writing to error.log:', error)
    }
  }

  getStreamData(
    stream: Stream,
    chunkHandler: (x: string) => void,
    originalMessage: string = ''
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
          const { content, role } = this.getData(line, originalMessage)

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

  pushStreamResponse(
    data: string,
    messageCallback: (message: string) => void,
    originalMessage: string
  ) {
    const lines: string[] = data.split('\n').filter((line: string) => line.trim() !== '')
    try {
      for (const line of lines) {
        const { content, role } = this.getData(line, originalMessage)

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
      console.log(`${COLOR.yellow}🤖`, this._model, COLOR.reset)
      try {
        const request = {
          model: this._model,
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

  async askDallEGenerate(message: string): Promise<IPhotoResponse[]> {
    return new Promise(async (resolve) => {
      try {
        const request = {
          prompt: message,
          n: 1,
          model: 'dall-e-3',
          quality: 'standard',
          size: '1792x1024',
          style: 'natural',
          // response_format: 'b64_json',
        }

        const response = await axios.post('images/generations', request)

        resolve(response.data.data as IPhotoResponse[])
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
        const message = code[code.length - 1].content

        this.getStreamData(
          streamResponse,
          (data: string) => this.pushStreamResponse(data, postMessageFn, message),
          message
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

  private embedFile(content: string): Promise<any> {
    const endpoint = 'embeddings'
    const requestBody = {
      input: 'Embed the following file content: ' + content,
      model: 'text-embedding-ada-002',
    }

    return axios.post(endpoint, requestBody).catch((err) => console.error(err))
  }

  async embed(filePath: string) {
    let fileContent = ''

    try {
      const resolvedPath = path.resolve(
        filePath.replace(/^~(?=\/|\\|$)/, process.env.HOME || process.env.USERPROFILE || '')
      )
      fileContent = await fs.readFile(path.resolve(resolvedPath), 'utf8')
    } catch (error) {
      console.error(error)
    }

    const { data } = await this.embedFile(fileContent)
    console.log(
      `🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ OpenAIWrapper ➡ embed ➡ response:`,
      data
    )
    const embeddings = data.choices[0]
    console.log(
      `🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ OpenAIWrapper ➡ embed ➡ embeddings:`,
      embeddings
    )

    return ''
  }
}

export default OpenAIWrapper
