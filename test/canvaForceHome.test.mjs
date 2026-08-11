import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCanvaPrivateDesignTitle,
  pageTextLooksLikeCanvaPrivate403,
  shouldForceCanvaHome,
  isAlreadyCanvaHome,
  canvaCatalogHome,
} from '../src/canvaForceHome.js';

test('isCanvaPrivateDesignTitle matches Canva 403 title', () => {
  assert.equal(isCanvaPrivateDesignTitle('This design is private'), true);
  assert.equal(isCanvaPrivateDesignTitle('Canva'), false);
});

test('pageText matches real Canva footer Error: 403 • Ray ID', () => {
  const sample =
    'This design is private\nGo to home to keep designing\nError: 403 • Ray ID: a298595e3c52c5da-BOM';
  assert.equal(pageTextLooksLikeCanvaPrivate403(sample), true);
  assert.equal(
    pageTextLooksLikeCanvaPrivate403('Error: 403 • Ray ID: abc-BOM'),
    true,
  );
});

test('shouldForceCanvaHome on title or HTTP 403', () => {
  assert.equal(
    shouldForceCanvaHome({
      url: 'https://www.canva.com/design/x/view',
      title: 'This design is private',
    }),
    true,
  );
  assert.equal(
    shouldForceCanvaHome({
      url: 'https://www.canva.com/design/x/view',
      httpStatus: 403,
    }),
    true,
  );
  assert.equal(
    shouldForceCanvaHome({
      url: 'https://www.canva.com/',
      title: 'Home - Canva',
      httpStatus: 200,
    }),
    false,
  );
});

test('isAlreadyCanvaHome and canvaCatalogHome', () => {
  assert.equal(isAlreadyCanvaHome('https://www.canva.com/'), true);
  assert.equal(isAlreadyCanvaHome('https://www.canva.com/design/x'), false);
  assert.equal(canvaCatalogHome('https://www.canva.in/design/x'), 'https://www.canva.in/');
});
