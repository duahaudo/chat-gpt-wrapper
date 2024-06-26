const extractJson = (input: string): string => {
  const start = input.indexOf('{')
  const end = input.lastIndexOf('}')

  if (start !== -1 && end !== -1) {
    return input.substring(start, end + 1)
  }

  return ''
}

const isJsonString = (input: string): boolean => {
  try {
    JSON.parse(input)
    return true
  } catch (e) {
    return false
  }
}

const correctJsonString = (input: string): string => {
  let output = input

  while (output.length > 0 && !isJsonString(output)) {
    output = output.substring(0, output.length - 1)
  }

  return output
}

export const getObject = (input: string): any => {
  try {
    const jsonString = extractJson(input)
    const fixJsonString = correctJsonString(jsonString)

    return fixJsonString ? JSON.parse(fixJsonString) : {}
  } catch (e) {
    console.log(`🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ getObject ➡ input:`, input)
    console.log(`🚀 SLOG (${new Date().toLocaleTimeString()}): ➡ getObject ➡ e:`, e)
  }
}

export const getEnumKeyByValue = (value: any, enumType: any): string | undefined => {
  return Object.keys(enumType).find((key) => enumType[key] === value)
}
