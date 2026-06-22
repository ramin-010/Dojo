export interface CloudUploadResult {
    url: string;
    publicId: string;
    provider: string;
    imageId: string;
    fileName?: string;
    fileType?: string;
    resource?: any;
}

export async function uploadToCloud(file: File, imageId?: string, topicId?: string, subjectId?: string): Promise<CloudUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (imageId) formData.append('imageId', imageId);
    if (topicId) formData.append('topicId', topicId);
    if (subjectId) formData.append('subjectId', subjectId);

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
            const errData = await response.json();
            if (errData.error) errorMessage = errData.error;
        } catch(e) {}
        throw new Error(errorMessage);
    }

    const data = await response.json();
    
    return {
        url: data.url,
        publicId: data.publicId,
        provider: data.provider,
        imageId: data.imageId || imageId || '',
        fileName: data.fileName,
        fileType: data.fileType,
    };
}
