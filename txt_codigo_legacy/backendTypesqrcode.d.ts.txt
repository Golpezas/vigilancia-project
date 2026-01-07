// types/qrcode.d.ts
declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  function toFile(
    path: string,
    text: string,
    options?: QRCodeOptions
  ): Promise<void>;

  export { toFile };
}