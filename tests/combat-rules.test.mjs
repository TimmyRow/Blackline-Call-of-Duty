import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roleForId,roleStats,enemyTactic,damageCombat,weaponDamage,rechargeShield,rechargeEnergy} from '../src/combat-rules.mjs';
test('enemy assignments are deterministic and retain five distinct encounter roles',()=>{
 const roles=new Set(Array.from({length:100},(_,i)=>roleForId(`harbour:${i}`)));
 assert.equal(roles.size,5);assert.equal(roleForId('relay:3'),roleForId('relay:3'));
 assert.ok(roleStats('heavy').health>roleStats('scout').health);
 assert.ok(enemyTactic('sniper',{distance:20}).advance<0);
 assert.ok(enemyTactic('scout',{distance:40}).advance>0);
});
test('energy breaks shields efficiently while ballistic rewards exposed targets',()=>{
 const victim={health:100,shield:70};
 assert.ok(damageCombat(victim,24,'energy').shield<damageCombat(victim,32,'ballistic').shield);
 assert.ok(weaponDamage('ballistic',false)>weaponDamage('energy',false));
 assert.deepEqual(damageCombat({health:100,shield:20},20,'energy'),{health:90,shield:0,absorbed:20});
 assert.equal(damageCombat(victim,-100).health,100);
 assert.equal(weaponDamage('energy',true,200),0);
});
test('shields require a damage-free window and energy cells require a firing pause',()=>{
 const s={health:100,shield:10,lastDamage:3};
 assert.equal(rechargeShield(s,1,7.9),10);assert.equal(rechargeShield(s,1,8),30);
 assert.equal(rechargeShield({...s,health:0},1,9),10);
 assert.equal(rechargeShield(s,100,10,3),130);
 assert.equal(rechargeEnergy(10,1,.5),10);assert.equal(rechargeEnergy(10,1,2),25);
});
