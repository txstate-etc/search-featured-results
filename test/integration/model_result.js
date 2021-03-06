/* global after, before, describe, it */
require('should')
const db = require('txstate-node-utils/lib/db')
var Result = require('../../models/result')

describe('integration', function () {
  describe('model', function () {
    describe('result', function () {
      var result = new Result()
      before(async function () {
        await db.connect()
        await Result.deleteMany()
        result.fromJson({
          url: 'http://txstate.edu',
          title: 'Texas State University Homepage',
          entries: [
            {
              keyphrase: 'Bobcat Village',
              mode: 'exact'
            }, {
              keyphrase: 'Texas State Homepage',
              mode: 'phrase'
            }, {
              keyphrase: 'Texas State University',
              mode: 'keyword'
            }
          ],
          tags: ['marketing']
        })
      })
      it('should save successfully', function () {
        return result.save()
      })
      it('should retrieve one record after saving', async function () {
        (await Result.find()).length.should.equal(1)
      })
      it('should not get anything from database when no matching words are present', async function () {
        (await Result.getByQuery(['oklahoma'])).length.should.equal(0)
      })
      it('should not get anything from database when one of three matching words is present', async function () {
        (await Result.getByQuery(['texas'])).length.should.equal(0)
      })
      it('should not get anything from database when two of three matching words are present', async function () {
        (await Result.getByQuery(['university', 'state'])).length.should.equal(0)
      })
      it('should not get anything from database when two words are present and only one matches', async function () {
        (await Result.getByQuery(['oklahoma', 'state'])).length.should.equal(0)
      })
      it('should not get anything from database when three words are present and only two match', async function () {
        (await Result.getByQuery(['university', 'state', 'oklahoma'])).length.should.equal(0)
      })
      it('should be case insensitive', async function () {
        (await Result.findByQuery('bObCAt VILLagE')).length.should.equal(1)
      })
      it('should return results when query words are given as lower case', async function () {
        (await Result.findByQuery('bobcat village')).length.should.equal(1)
      })
      it('should not return results when mode is exact and query has an extra word', async function () {
        (await Result.findByQuery('bobcat village apartments')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query is an exact match', async function () {
        (await Result.findByQuery('texas state homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and words are missing from the query', async function () {
        (await Result.findByQuery('homepage')).length.should.equal(0)
      })
      it('should return results when mode is phrase and query has an extra word at the end', async function () {
        (await Result.findByQuery('texas state homepage links')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word at the beginning', async function () {
        (await Result.findByQuery('show texas state homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted', async function () {
        (await Result.findByQuery('texas state full homepage')).length.should.equal(1)
      })
      it('should return results when mode is phrase and query has an extra word inserted in two places', async function () {
        (await Result.findByQuery('texas bobcats state full homepage')).length.should.equal(1)
      })
      it('should not return results when mode is phrase and query is out of order', async function () {
        (await Result.findByQuery('texas homepage state')).length.should.equal(0)
      })
      it('should return results when mode is keyword and query is out of order', async function () {
        (await Result.findByQuery('texas university state')).length.should.equal(1)
      })
      it('should return results when mode is keyword and query is out of order with extra words', async function () {
        (await Result.findByQuery('show texas full university bobcats state')).length.should.equal(1)
      })
      it('should find broken links', async function () {
        const result = new Result()
        result.fromJson({
          url: 'http://txstate.edu/thisisabrokenlink',
          title: 'Texas State University Homepage',
          entries: [
            {
              keyphrase: 'broken link',
              mode: 'exact'
            }
          ],
          tags: ['broken']
        })
        await result.save()
        await Result.currencyTestAll()
        const badresult = (await Result.findByQuery('broken link'))[0]
        badresult.currency.broken.should.be.true()
        const goodresult = (await Result.findByQuery('texas university state'))[0]
        goodresult.currency.broken.should.be.false()
      })
      it('should sort search results by priority', async function () {
        const secondresult = new Result()
        secondresult.fromJson({
          url: 'http://google.com',
          title: 'Google',
          priority: 2,
          entries: [
            {
              keyphrase: 'Bobcat Village',
              mode: 'exact'
            }
          ]
        })
        await secondresult.save()
        let results = await Result.findByQuery('bobcat village')
        results[0].title.should.not.equal('Google')
        results[1].title.should.equal('Google')
        secondresult.priority = 0
        await secondresult.save()
        results = await Result.findByQuery('bobcat village')
        results[1].title.should.not.equal('Google')
        results[0].title.should.equal('Google')
      })
      after(function () {
        return db.disconnect()
      })
    })
  })
})
