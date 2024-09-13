import { prompt } from 'enquirer'

class EnquirerWrapper {
  async getMultilineInput(promptMessage: string): Promise<string> {
    const response: { input: string } = await prompt({
      type: 'input',
      name: 'input',
      message: promptMessage,
      multiline: true,
      prefix: '❓',
    })

    return response.input || ''
  }

  async selectOptionFromList(
    promptMessage: string,
    options: string[] | { name: string; value: string }[]
  ): Promise<string> {
    const response: { option: string } = await prompt({
      type: 'select',
      name: 'option',
      message: promptMessage,
      choices: options,
      prefix: '🤖',
    })

    return response.option || ''
  }
}

export default EnquirerWrapper
