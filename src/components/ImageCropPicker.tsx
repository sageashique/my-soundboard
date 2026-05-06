'use client'
import { useCallback, useRef, useState } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface Props {
  onCrop: (blob: Blob) => void
  onCancel: () => void
}

export default function ImageCropPicker({ onCrop, onCancel }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height))
  }

  const handleCrop = useCallback(() => {
    if (!imgRef.current || !completedCrop?.width) return
    const img = imgRef.current
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    ctx.drawImage(
      img,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0, 0, 200, 200
    )
    canvas.toBlob(blob => { if (blob) onCrop(blob) }, 'image/jpeg', 0.8)
  }, [completedCrop, onCrop])

  if (!src) {
    return (
      <div className="icp-file-zone" onClick={() => inputRef.current?.click()}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onSelectFile}
          style={{ display: 'none' }}
        />
        <span className="icp-file-icon">🖼️</span>
        <span className="icp-file-text">Click to choose an image</span>
        <span className="icp-file-sub">JPG · PNG · WebP</span>
      </div>
    )
  }

  return (
    <div className="icp-crop-wrap">
      <div className="icp-crop-area">
        <ReactCrop
          crop={crop}
          onChange={c => setCrop(c)}
          onComplete={c => setCompletedCrop(c)}
          aspect={1}
          circularCrop
          minWidth={40}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            className="icp-crop-img"
            onLoad={onImageLoad}
          />
        </ReactCrop>
      </div>
      <div className="icp-crop-actions">
        <button
          className="btn btn-outline"
          onClick={() => { setSrc(null); onCancel() }}
        >
          Cancel
        </button>
        <button
          className="btn btn-solid"
          onClick={handleCrop}
          disabled={!completedCrop?.width}
        >
          Use image
        </button>
      </div>
    </div>
  )
}
