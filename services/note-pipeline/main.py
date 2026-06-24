import io
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pipeline import NoteImagePipeline, PipelineConfig, OutputMode

app = FastAPI(title="Note Pipeline Service")

# Allow requests from the Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/process")
async def process_note(
    file: UploadFile = File(...),
    output_mode: str = Form("binary"),
    denoise_strength: float = Form(7.0)
):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Read the file bytes
    file_bytes = await file.read()
    
    # Map the mode
    try:
        mode_enum = OutputMode(output_mode)
    except ValueError:
        mode_enum = OutputMode.BINARY

    # Configure the pipeline
    config = PipelineConfig(
        output_mode=mode_enum,
        denoise_strength=denoise_strength,
        output_resolution=2400
    )
    
    pipeline = NoteImagePipeline(config)
    
    # Process
    try:
        result = pipeline.process(file_bytes)
        
        if not result.success:
            raise HTTPException(status_code=500, detail=result.error or "Processing failed")
            
        # Convert to jpeg bytes
        jpeg_bytes = result.to_bytes(fmt="jpeg", quality=90)
        
        # Return as a base64 string to match the previous Next.js behavior easily
        b64 = base64.b64encode(jpeg_bytes).decode('utf-8')
        data_url = f"data:image/jpeg;base64,{b64}"
        
        return {
            "url": data_url,
            "timing_ms": result.processing_time_ms,
            "stages": result.stages
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8004, reload=True)
