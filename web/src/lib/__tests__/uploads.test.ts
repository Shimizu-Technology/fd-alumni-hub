import { describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { RECEIPT_UPLOAD_MAX_BYTES, uploadCampaignReceipt } from '../uploads'

describe('uploadCampaignReceipt', () => {
  it('rejects empty, oversized, and unsupported MIME files before calling API', async () => {
    const presignSpy = vi.spyOn(api, 'campaignPresignReceipt')

    const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' })
    await expect(uploadCampaignReceipt({ file: emptyFile, campaignSlug: '2027-co2017' })).rejects.toThrow(/not empty/i)

    const svgFile = new File(['<svg/>'], 'xss.svg', { type: 'image/svg+xml' })
    await expect(uploadCampaignReceipt({ file: svgFile, campaignSlug: '2027-co2017' })).rejects.toThrow(/JPEG, PNG, WebP, HEIC/i)

    const bigFile = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
    Object.defineProperty(bigFile, 'size', { value: RECEIPT_UPLOAD_MAX_BYTES + 1 })
    await expect(uploadCampaignReceipt({ file: bigFile, campaignSlug: '2027-co2017' })).rejects.toThrow(/15MB/i)

    expect(presignSpy).not.toHaveBeenCalled()
  })

  it('normalizes image/heif to image/heic and posts presigned fields with file last', async () => {
    const presignSpy = vi.spyOn(api, 'campaignPresignReceipt').mockResolvedValue({
      uploadToken: 'tok_abc123',
      maxBytes: RECEIPT_UPLOAD_MAX_BYTES,
      expiresIn: 60,
      upload: {
        url: 'https://private.s3.ap-southeast-2.amazonaws.com/',
        fields: {
          'Content-Type': 'image/heic',
          key: 'receipts/1/photo.heif',
          Policy: 'abc',
          'X-Amz-Signature': 'sig',
        },
      },
    })

    let capturedForm: FormData | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedForm = init?.body as FormData
      return new Response(null, { status: 204 })
    })

    const heifFile = new File(['heif-bytes'], 'photo.heif', { type: 'image/heif' })
    const token = await uploadCampaignReceipt({ file: heifFile, campaignSlug: '2027-co2017' })

    expect(token).toBe('tok_abc123')
    expect(presignSpy).toHaveBeenCalledWith('2027-co2017', {
      filename: 'photo.heif',
      contentType: 'image/heic',
      byteSize: heifFile.size,
    })
    expect(capturedForm).not.toBeNull()
    const keys = Array.from((capturedForm as unknown as FormData).keys())
    expect(keys[keys.length - 1]).toBe('file')
  })
})
