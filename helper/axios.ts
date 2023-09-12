import axios, { AxiosInstance } from 'axios'
import 'dotenv/config'

export interface Message {
  role: string
  content: string
}

class CustomAxios {
  private instance: AxiosInstance

  constructor() {
    this.instance = axios.create({
      baseURL: 'https://api.openai.com/v1/',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    })
  }

  getInstance(): AxiosInstance {
    return this.instance
  }
}

const axiosInstance = new CustomAxios()
export default axiosInstance.getInstance()
