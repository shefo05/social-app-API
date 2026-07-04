export interface UploadResult {
  url: string;
  publicId: string;
}

export interface ICloudProvider {
  uploadFile(file: Express.Multer.File, folder: string): Promise<UploadResult>;

  deleteFile(publicId: string): Promise<void>;
}
