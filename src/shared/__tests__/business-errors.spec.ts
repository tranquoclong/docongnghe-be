import { OrderNotFoundException, OutOfStockSKUException, NotFoundCartItemException, SKUNotBelongToShopException, CannotCancelOrderException } from 'src/routes/order/order.error'
import { VOUCHER_ERRORS } from 'src/routes/voucher/voucher.error'
import { WishlistItemNotFoundException, WishlistCollectionNotFoundException, WishlistItemAlreadyExistsException, NoSKUSelectedException, UnauthorizedWishlistAccessException } from 'src/routes/wishlist/wishlist.error'
import { NotFoundSKUException, OutOfStockSKUException as CartOutOfStockSKUException, ProductNotFoundException as CartProductNotFoundException, NotFoundCartItemException as CartNotFoundCartItemException, InvalidQuantityException } from 'src/routes/cart/cart.error'
import { ADDRESS_ERRORS } from 'src/routes/address/address.error'
import { LanguageAlreadyExistsException } from 'src/routes/language/language.error'
import { RoleAlreadyExistsException, ProhibitedActionOnBaseRoleException } from 'src/routes/role/role.error'
import { PermissionAlreadyExistsException } from 'src/routes/permission/permission.error'
import { UserAlreadyExistsException, CannotUpdateAdminUserException, CannotDeleteAdminUserException, CannotSetAdminRoleToUserException, RoleNotFoundException, CannotUpdateOrDeleteYourselfException } from 'src/routes/user/user.error'
import { BrandTranslationAlreadyExistsException } from 'src/routes/brand/brand-translation/brand-translation.error'
import { CategoryTranslationAlreadyExistsException } from 'src/routes/category/category-translation/category-translation.error'
import { ProductTranslationAlreadyExistsException } from 'src/routes/product/product-translation/product-translation.error'

describe('Business Error Snapshots', () => {
  describe('Order Errors', () => {
    it('OrderNotFoundException', () => {
      expect(OrderNotFoundException.getResponse()).toMatchSnapshot()
    })
    it('OutOfStockSKUException', () => {
      expect(OutOfStockSKUException.getResponse()).toMatchSnapshot()
    })
    it('NotFoundCartItemException', () => {
      expect(NotFoundCartItemException.getResponse()).toMatchSnapshot()
    })
    it('SKUNotBelongToShopException', () => {
      expect(SKUNotBelongToShopException.getResponse()).toMatchSnapshot()
    })
    it('CannotCancelOrderException', () => {
      expect(CannotCancelOrderException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Voucher Errors', () => {
    it.each(Object.entries(VOUCHER_ERRORS))('%s should match snapshot', (_key, error) => {
      expect(error).toMatchSnapshot()
    })
  })

  describe('Wishlist Errors', () => {
    it('WishlistItemNotFoundException', () => {
      expect(WishlistItemNotFoundException.getResponse()).toMatchSnapshot()
    })
    it('WishlistCollectionNotFoundException', () => {
      expect(WishlistCollectionNotFoundException.getResponse()).toMatchSnapshot()
    })
    it('WishlistItemAlreadyExistsException', () => {
      expect(WishlistItemAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
    it('NoSKUSelectedException', () => {
      expect(NoSKUSelectedException.getResponse()).toMatchSnapshot()
    })
    it('UnauthorizedWishlistAccessException', () => {
      expect(UnauthorizedWishlistAccessException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Cart Errors', () => {
    it('NotFoundSKUException', () => {
      expect(NotFoundSKUException.getResponse()).toMatchSnapshot()
    })
    it('CartOutOfStockSKUException', () => {
      expect(CartOutOfStockSKUException.getResponse()).toMatchSnapshot()
    })
    it('CartProductNotFoundException', () => {
      expect(CartProductNotFoundException.getResponse()).toMatchSnapshot()
    })
    it('CartNotFoundCartItemException', () => {
      expect(CartNotFoundCartItemException.getResponse()).toMatchSnapshot()
    })
    it('InvalidQuantityException', () => {
      expect(InvalidQuantityException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Address Errors', () => {
    it.each(Object.entries(ADDRESS_ERRORS))('%s should match snapshot', (_key, error) => {
      expect(error).toMatchSnapshot()
    })
  })

  describe('Language Errors', () => {
    it('LanguageAlreadyExistsException', () => {
      expect(LanguageAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Role Errors', () => {
    it('RoleAlreadyExistsException', () => {
      expect(RoleAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
    it('ProhibitedActionOnBaseRoleException', () => {
      expect(ProhibitedActionOnBaseRoleException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Permission Errors', () => {
    it('PermissionAlreadyExistsException', () => {
      expect(PermissionAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
  })

  describe('User Errors', () => {
    it('UserAlreadyExistsException', () => {
      expect(UserAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
    it('CannotUpdateAdminUserException', () => {
      expect(CannotUpdateAdminUserException.getResponse()).toMatchSnapshot()
    })
    it('CannotDeleteAdminUserException', () => {
      expect(CannotDeleteAdminUserException.getResponse()).toMatchSnapshot()
    })
    it('CannotSetAdminRoleToUserException', () => {
      expect(CannotSetAdminRoleToUserException.getResponse()).toMatchSnapshot()
    })
    it('RoleNotFoundException', () => {
      expect(RoleNotFoundException.getResponse()).toMatchSnapshot()
    })
    it('CannotUpdateOrDeleteYourselfException', () => {
      expect(CannotUpdateOrDeleteYourselfException.getResponse()).toMatchSnapshot()
    })
  })

  describe('Translation Errors', () => {
    it('BrandTranslationAlreadyExistsException', () => {
      expect(BrandTranslationAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
    it('CategoryTranslationAlreadyExistsException', () => {
      expect(CategoryTranslationAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
    it('ProductTranslationAlreadyExistsException', () => {
      expect(ProductTranslationAlreadyExistsException.getResponse()).toMatchSnapshot()
    })
  })
})
