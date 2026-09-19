import {QUEST_PEOPLE} from './quest-data.mjs';
import {OPERATIONS} from './field-operations.mjs';
import {normalizeBase} from './base-services.mjs';

const REPORTS={
 'op-escape':'The courier’s recorder reached us intact. I have sent the convoy crews a safer route. They left supplies for your next trip.',
 'op-infiltration':'Those listening records exposed the pirates’ lookout frequencies. Our survey crews can move again. Take this field cache before heading out.',
 'op-rescue':'Both survey survivors are here, fed and resting. One asked me to make sure you had enough supplies to bring the next team home.',
 'op-defense':'The relief team made it through. Their medical crates are already in the shelter. They saved a field cache for the squad that held the road.',
 'op-sabotage':'With those ammunition trucks gone, the harbour crews have a chance to move their boats. They pooled a few supplies to thank you.'
};
export function debriefOffers(c,personId){
 const person=QUEST_PEOPLE.find(p=>p.id===personId);
 if(!person||!c.metPeople?.includes(personId)||(person.requires&&!c.completed?.includes(person.requires)))return [];
 const locker=normalizeBase(c.baseLocker),room=locker.reserve<=540&&locker.grenades<=9;
 return OPERATIONS.filter(o=>person.quests.includes(o.id)&&c.contracts?.[o.id]==='complete').map(o=>({
  id:o.id,title:o.title,text:REPORTS[o.id],claimed:c.debriefedOperations?.includes(o.id)??false,
  room,reward:'60 rounds + 1 grenade in your squad locker',
  reason:room?'':'Make room in your squad locker: use Equipment & Travel to withdraw supplies.'
 }));
}
export function claimDebrief(c,personId,id){
 const offer=debriefOffers(c,personId).find(o=>o.id===id);
 if(!offer||offer.claimed)return {ok:false,message:'No unclaimed field cache for this operation.'};
 if(!offer.room)return {ok:false,message:offer.reason};
 const locker=normalizeBase(c.baseLocker);
 c.baseLocker={reserve:locker.reserve+60,grenades:locker.grenades+1};
 c.debriefedOperations??=[];c.debriefedOperations.push(id);
 return {ok:true,message:'Field cache stored: 60 rounds + 1 grenade. Collect them from Equipment & Travel at a friendly base.',title:offer.title};
}
