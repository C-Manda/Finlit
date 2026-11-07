const assert=require('node:assert/strict'),load=require('./load-typescript.cjs');
const {parseSms}=load('features/sms/parsers/registry.ts'),{minorUnits}=load('features/sms/parsers/shared.ts');
const fixtures=[
 ['MTN','Yello.You have received ZMW 50.00 from SAMPLE SENDER on your mobile money account at 2026-11-02 11:05:28. Message from sender: . Financial Transaction ID: 10980000001. Dial *115# to view balance. Thank you for using Momo from MTN.','mtn','received',5000,null,null,'10980000001','2026-11-02T09:05:28.000Z'],
 ['MTN','Your Mobile Money account balance is ZMW 61.76.Date:2026-11-04 09:17:06.Thank you for using MTN mobile Money.','mtn','balance_check',null,null,6176,null,'2026-11-04T07:17:06.000Z'],
 ['MTN','You have withdrawn 50.00 ZMW from your mobile money account at  on 2026-11-04 10:26:04. Your new balance:9.26 ZMW. Financial Transaction Id: 11000000001.','mtn','withdrawal',5000,null,926,'11000000001','2026-11-04T08:26:04.000Z'],
 ['Airtel','You have sent Money to SAMPLE PERSON on 63000000000.Amount K1,550. Txn. ID : MP261028.1707.Z00001.Your available balance is K101.42','airtel','sent',155000,null,10142,'MP261028.1707.Z00001',null],
 ['Airtel','Payment of ZMW 30.00 Till Number BUYAIRTEL ZESCO ZESCO. Airtel Money bal is ZMW 69.42. TID : MP261028.2008.Y00001.','airtel','bill_payment',3000,null,6942,'MP261028.2008.Y00001',null],
 ['Airtel','You have withdrawn ZMW 400.00 from 1300000 SAMPLE AGENT. Bal is ZMW 21.42. TID: CO261027.1918.E00001.','airtel','withdrawal',40000,null,2142,'CO261027.1918.E00001',null],
 ['Zamtel','Dear SAMPLE USER, your transaction of ZMW 45.00 for ZAMTEL USSD with Fee: ZMW .00 was processed successfully on 29-10-2026 at 00:14:54 under Txn ID: KUJ8TEST. Your account balance is now ZMW 1.00.\n#MakeLifeHappen with Zamtel','zamtel','merchant_payment',4500,0,100,'KUJ8TEST','2026-10-28T22:14:54.000Z'],
 ['Zamtel','Dear SAMPLE USER, you have received ZMW 45.00 from SAMPLE SENDER - 0760000000 on 14-10-2026 21:18:01 under Txn ID: SGLHTEST. Your account balance is now ZMW 46.00.','zamtel','received',4500,null,4600,'SGLHTEST','2026-10-14T19:18:01.000Z'],
];
const message=(body,sender='MTN')=>({id:'fixture',body,sender,receivedAt:'2026-11-04T11:00:00.000Z',subscriptionId:null,fingerprint:'a'.repeat(64)});
for(const [sender,body,provider,kind,amt,fee,bal,ref,time] of fixtures){const p=parseSms(message(body,sender));assert(p,body);assert.equal(p.provider,provider);assert.equal(p.kind,kind);assert.equal(p.amountMinor,amt);assert.equal(p.feeMinor,fee);assert.equal(p.balanceMinor,bal);assert.equal(p.reference,ref);assert.equal(p.occurredAt,time??message('').receivedAt);assert.equal(p.timestampSource,time?'provider':'receipt');assert.notEqual(p.status,'imported');}
const variant=fixtures[3][1].replace('You have sent Money to','Money sent to').replace('K1,550','K1,550.50').replace('Txn. ID :','TID:').replace('Your available balance is','Your bal is');assert.equal(parseSms(message(variant,'Airtel')).amountMinor,155050);
const additional=[
 ['MTN','You have withdrawn ZMW 75.00 from your mobile money account. Your new balance: ZMW 125.00. Financial Transaction Id: 11000000002.','withdrawal',7500,12500,'11000000002'],
 ['MTN','Payment of ZMW 2.00 to Mobile Money Data Bundle successful. Your new balance: ZMW 8.00. Financial Transaction ID: 12000000001.','data_purchase',200,800,'12000000001'],
 ['MTN','Payment of ZMW 5.00 to Mobile Money successful, successfully purchased K5:6GB/5hrs. Your new balance: ZMW 3.00. Financial Transaction ID: 12000000002.','data_purchase',500,300,'12000000002'],
 ['MTN','Payment of ZMW 10.00 to Mobile Money Airtime successful. Your new balance: ZMW 2.00. Financial Transaction ID: 12000000003.','airtime_purchase',1000,200,'12000000003'],
 ['MTN','You have received ZMW 20.00 from Airtel NFS. Your new balance: ZMW 30.00. Financial Transaction ID: 13000000001.','bank_transfer',2000,3000,'13000000001'],
 ['MTN','Payment of ZMW 20.00 to AIRTEL NFS. Your new balance: ZMW 10.00. Financial Transaction ID: 13000000002.','bank_transfer',2000,1000,'13000000002'],
 ['MTN','You have been credited with a NaSova loan of ZMW 50.00 from JUMO. Your new balance: ZMW 60.00. Txn. Id: LN12345.','loan',5000,6000,'LN12345'],
 ['Airtel','You have received ZMW 44.00 from SAMPLE PERSON. Your bal is ZMW 100.00. TID: PP261104.1100.H48969.','received',4400,10000,'PP261104.1100.H48969'],
 ['Airtel','You have purchased a data bundle of ZMW 5.00. Airtel Money bal is ZMW 95.00. TID: MP261104.1101.H48970.','data_purchase',500,9500,'MP261104.1101.H48970'],
 ['Airtel','You have purchased airtime of ZMW 3.00. Bal is ZMW 92.00. TID: CO261104.1102.H48971.','airtime_purchase',300,9200,'CO261104.1102.H48971'],
 ['Airtel','Money received from MNOWALLET NFS SETTLEMENT ACCOUNT. Amount ZMW 25.00. Your available balance is ZMW 117.00. TID: PP261104.1103.H48972.','bank_transfer',2500,11700,'PP261104.1103.H48972'],
];
for(const [sender,body,kind,amt,bal,ref] of additional){const p=parseSms(message(body,sender));assert(p,body);assert.equal(p.kind,kind);assert.equal(p.amountMinor,amt);assert.equal(p.balanceMinor,bal);assert.equal(p.reference,ref);}
assert.equal(parseSms(message('MTN data bundle special offer ZMW 5 promotion','MTN')),null);
assert.equal(parseSms(message('Unrecognised mobile wallet payment of ZMW 9.00 for a subscription','Wallet')).kind,'unknown');
assert.equal(parseSms(message(fixtures[0][1].replace('ZMW 50.00','ZMW 1,55.00'))).amountMinor,null);
assert.equal(parseSms(message(fixtures[0][1].replace('ZMW 50.00','ZMW '))).amountMinor,null);
assert.equal(parseSms(message(fixtures[0][1].replace(/Financial Transaction ID: \d+\./,''))).reference,null);
assert.equal(parseSms(message(fixtures[0][1],'0760000001')).warnings.some(w=>w.includes('Sender')),true);
assert.equal(parseSms(message(fixtures[0][1]+' Transaction failed.')).status,'failed');
for(const text of ['Meet at school tomorrow','Your OTP is 123456 from MTN','MTN special offer ZMW 50','Your PIN is 1234'])assert.equal(parseSms(message(text)),null);
assert.equal(parseSms(message('Airtel transaction ID unknown amount')).amountMinor,null);
assert.equal(minorUnits('.00'),0);assert.equal(minorUnits('1,550.50'),155050);for(const v of ['1,55','1.234','-1','NaN',''])assert.equal(minorUnits(v),null);
const duplicate=parseSms(message(fixtures[0][1]));assert.deepEqual(duplicate,parseSms(message(fixtures[0][1])));
assert.notEqual(duplicate.reference,parseSms(message(fixtures[0][1].replace('10980000001','10980000002'))).reference);
console.log('SMS parser PASS: all eight observed templates; Airtel variants; exact money; explicit-zero versus unknown fee; timestamps; reference separation; malformed/OTP/promotional/suspicious/failed messages.');
module.exports={fixtures,message};
