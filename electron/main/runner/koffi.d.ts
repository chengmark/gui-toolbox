declare module 'koffi' {
  interface KoffiFunction {
    (...args: unknown[]): unknown
  }

  interface KoffiLib {
    func(definition: string): KoffiFunction
  }

  interface Koffi {
    load(name: string): KoffiLib
  }

  const koffi: Koffi
  export default koffi
}
