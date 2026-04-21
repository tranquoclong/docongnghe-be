import {
  InvalidOTPException,
  OTPExpiredException,
  FailedToSendOTPException,
  EmailAlreadyExistsException,
  EmailNotFoundException,
  RefreshTokenAlreadyUsedException,
  UnauthorizedAccessException,
  TOTPAlreadyEnabledException,
  TOTPNotEnabledException,
  InvalidTOTPAndCodeException,
  InvalidTOTPException,
} from '../auth.error'

describe('Auth Error Snapshots', () => {
  describe('OTP Errors', () => {
    it('InvalidOTPException response should match snapshot', () => {
      expect(InvalidOTPException.getResponse()).toMatchSnapshot()
    })

    it('OTPExpiredException response should match snapshot', () => {
      expect(OTPExpiredException.getResponse()).toMatchSnapshot()
    })

    it('FailedToSendOTPException response should match snapshot', () => {
      expect(FailedToSendOTPException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Email Errors', () => {
    it('EmailAlreadyExistsException response should match snapshot', () => {
      expect(EmailAlreadyExistsException.getResponse()).toMatchSnapshot()
    })

    it('EmailNotFoundException response should match snapshot', () => {
      expect(EmailNotFoundException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Token Errors', () => {
    it('RefreshTokenAlreadyUsedException response should match snapshot', () => {
      expect(RefreshTokenAlreadyUsedException.getResponse()).toMatchSnapshot()
    })

    it('UnauthorizedAccessException response should match snapshot', () => {
      expect(UnauthorizedAccessException.getResponse()).toMatchSnapshot()
    })
  })

  describe('TOTP Errors', () => {
    it('TOTPAlreadyEnabledException response should match snapshot', () => {
      expect(TOTPAlreadyEnabledException.getResponse()).toMatchSnapshot()
    })

    it('TOTPNotEnabledException response should match snapshot', () => {
      expect(TOTPNotEnabledException.getResponse()).toMatchSnapshot()
    })

    it('InvalidTOTPAndCodeException response should match snapshot', () => {
      expect(InvalidTOTPAndCodeException.getResponse()).toMatchSnapshot()
    })

    it('InvalidTOTPException response should match snapshot', () => {
      expect(InvalidTOTPException.getResponse()).toMatchSnapshot()
    })
  })
})
