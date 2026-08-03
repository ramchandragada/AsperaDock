import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDealsSearchCriteria,
  escapeZohoCriteriaValue,
  mapDealRecord,
  mapDealRecords,
  sanitizeDealQuery,
} from '../src/zohoCrm/deals.js';
import { resolveZohoCrmDc, sanitizeZohoCrmDc } from '../src/zohoCrm/dc.js';
import { buildCrmLookupHtml } from '../src/crmLookupHtml.js';

test('sanitizeDealQuery trims and caps length', () => {
  assert.equal(sanitizeDealQuery('  Acme Corp  '), 'Acme Corp');
  assert.equal(sanitizeDealQuery('x'.repeat(120)).length, 80);
});

test('buildDealsSearchCriteria searches Deal_Name and Account_Name', () => {
  const criteria = buildDealsSearchCriteria('Flexi Loan');
  assert.match(criteria, /Deal_Name:contains:Flexi Loan/);
  assert.match(criteria, /Account_Name:contains:Flexi Loan/);
  assert.equal(buildDealsSearchCriteria(''), '');
});

test('escapeZohoCriteriaValue escapes reserved characters', () => {
  assert.equal(escapeZohoCriteriaValue('a(b):c'), 'a\\(b\\)\\:c');
});

test('mapDealRecord extracts stage and builds web URL', () => {
  const deal = mapDealRecord(
    {
      id: '123',
      Deal_Name: 'Q2 Expansion',
      Stage: 'Negotiation/Review',
      Amount: 50000,
      Closing_Date: '2026-09-01',
      Account_Name: { name: 'Acme' },
      Owner: { name: 'Priya' },
      Probability: 40,
    },
    { crmHost: 'https://crm.zoho.in' },
  );
  assert.equal(deal.name, 'Q2 Expansion');
  assert.equal(deal.stage, 'Negotiation/Review');
  assert.equal(deal.accountName, 'Acme');
  assert.equal(deal.ownerName, 'Priya');
  assert.equal(deal.amount, 50000);
  assert.match(deal.webUrl, /module=Deals/);
  assert.match(deal.webUrl, /id=123/);
});

test('mapDealRecords filters incomplete rows', () => {
  const deals = mapDealRecords({
    data: [{ id: '1', Deal_Name: 'A', Stage: 'Closed Won' }, { Deal_Name: 'No id' }],
  });
  assert.equal(deals.length, 1);
  assert.equal(deals[0].stage, 'Closed Won');
});

test('India is the default Zoho CRM data center', () => {
  assert.equal(sanitizeZohoCrmDc(''), 'in');
  assert.equal(resolveZohoCrmDc('in').apiDomain, 'https://www.zohoapis.in');
  assert.equal(resolveZohoCrmDc('com').accountsUrl, 'https://accounts.zoho.com');
});

test('CRM lookup popup renders deal stage UI hooks', () => {
  const html = buildCrmLookupHtml(false);
  assert.match(html, /Zoho CRM Deals/);
  assert.match(html, /Open deal/);
  assert.match(html, /Copy stage/);
  assert.match(html, /crmLookupApi/);
});
