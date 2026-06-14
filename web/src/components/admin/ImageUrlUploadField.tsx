import { useId, useState, type ChangeEvent } from 'react'
import { mutationErrorMessage } from '../../lib/errors'
import { ADMIN_IMAGE_UPLOAD_ACCEPT, uploadAdminImage, type AdminImageUploadPurpose } from '../../lib/uploads'

export function ImageUrlUploadField({
  label,
  value,
  onChange,
  tournamentId,
  purpose,
  required = false,
  placeholder = 'https://...',
  help = 'Paste a public image URL or upload a new image to S3.',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  tournamentId?: string | null
  purpose: AdminImageUploadPurpose
  required?: boolean
  placeholder?: string
  help?: string
}) {
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success')

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!tournamentId) {
      setMessageTone('error')
      setMessage('Select a tournament before uploading an image')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const publicUrl = await uploadAdminImage({ file, tournamentId, purpose })
      onChange(publicUrl)
      setMessageTone('success')
      setMessage('Upload complete. The image URL is ready to save.')
    } catch (err) {
      setMessageTone('error')
      setMessage(mutationErrorMessage(err, 'Unable to upload image'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="field">
      <label htmlFor={inputId}><span>{label}</span></label>
      <div className="image-url-upload">
        <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
        <input type="file" accept={ADMIN_IMAGE_UPLOAD_ACCEPT} onChange={handleFile} disabled={uploading || !tournamentId} aria-label={`Upload ${label.toLowerCase()}`} />
        {help && <small className="field-help">{help}</small>}
        {uploading && <small className="image-upload-status" role="status">Uploading image to S3…</small>}
        {message && !uploading && <small className={`image-upload-status ${messageTone}`} role={messageTone === 'error' ? 'alert' : 'status'}>{message}</small>}
      </div>
    </div>
  )
}
