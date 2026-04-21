import { http, HttpResponse } from 'msw'

export const s3Handlers = [
  // PUT — S3 upload requests (matches any S3 bucket URL pattern)
  http.put(/https:\/\/.*\.s3\..*\.amazonaws\.com\/.*/, () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        ETag: '"mock-etag-123"',
        Location: 'https://mock-bucket.s3.us-east-1.amazonaws.com/mock-key',
      },
    })
  }),
]
