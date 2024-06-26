import axios, { AxiosInstance } from 'axios'
import 'dotenv/config'
import { MODEL } from './constance'
export interface Message {
  role: string
  content: string
}

class CustomAxios {
  // @ts-ignore
  private instance: AxiosInstance
  private currentModel?: MODEL

  constructor(model?: MODEL) {
    this.createOrUpdateInstance(model)
  }

  getInstance(): AxiosInstance {
    return this.instance
  }

  // Method to create or update the AxiosInstance based on the model
  createOrUpdateInstance(model?: MODEL): void {
    const baseURL =
      model && model.startsWith('gpt-') ? 'https://api.openai.com/v1/' : 'http://localhost:1234/v1/'

    // Check if model has changed or instance does not exist
    if (this.currentModel !== model || !this.instance) {
      this.instance = axios.create({
        baseURL,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      })
      this.currentModel = model // Update the current model
    }
  }
}

let axiosInstance = new CustomAxios()

export const createInstance = (model: MODEL) => {
  // Instead of creating a new instance, update the existing one if model changes
  axiosInstance.createOrUpdateInstance(model)
  return axiosInstance.getInstance()
}
