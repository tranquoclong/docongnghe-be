import { NotFoundRecordException, InvalidPasswordException } from '../error'

describe('Shared Error Snapshots', () => {
  it('NotFoundRecordException response should match snapshot', () => {
    expect(NotFoundRecordException.getResponse()).toMatchSnapshot()
  })

  it('InvalidPasswordException response should match snapshot', () => {
    expect(InvalidPasswordException.getResponse()).toMatchSnapshot()
  })
})
