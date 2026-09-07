import {usesShipPurchase,ownsShip,shipOffer,HANGAR} from './ship-purchase.mjs';
import {MAIN_CONTRACTS,QUEST_PEOPLE} from './quest-data.mjs';
import {CONTRACTS,ensureProgression,acceptContract} from './progression.mjs';
import {AUTHORED_SITES} from './mission-rules.mjs';
import {heightAt} from './region-layout.mjs';
import {recoveryBrief} from './opening-mission.mjs';
export function personTarget(person){return {id:'person:'+person.id,name:person.name+' / '+person.town,x:person.x,z:person.z,elevation:heightAt(person.x,person.z),kind:'resident',faction:'friendly',radius:3};}
export function personAvailable(person,c){return !person.requires||c.completed.includes(person.requires);}
export function personDialogue(person,c){
 const completed=person.quests.filter(id=>c.contracts?.[id]==='complete'),active=person.quests.filter(id=>c.contracts?.[id]==='active');
 if(completed.length===person.quests.length&&completed.length)return person.thanks||'You made a difference here. Thank you for helping us.';
 if(active.length)return person.followup||person.greeting;
 if(completed.length)return (person.thanks||'Thank you for helping us.')+' '+person.greeting;
 return person.greeting;
}
export function mainQuest(c){
 ensureProgression(c);const mara=personTarget(QUEST_PEOPLE[0]);
 const chapters=[
  {...recoveryBrief(c),stage:'recovery',done:c.onboarding.stage==='complete',target:null},
  {stage:'briefing',title:'A voice in Pathfinder',description:'Meet Mara Voss beside the communications shelter in Pathfinder Landing.',done:c.story.briefed,target:mara},
  ...MAIN_CONTRACTS.map((id,i)=>{const contract=CONTRACTS.find(k=>k.id===id),site=AUTHORED_SITES.find(s=>s.id===contract.bearing);const descriptions=[
   'Recover the route ledger from Cold Harbour. It identifies the relay the pirates use to jam the settlements.',
   'Take Northwatch Array and recover its transmission keys. They contain a distress call from the captured Corsair.',
   'Free the Corsair crew and reclaim the vessel. Its command codes will get you into Meridian Anchorage.',
   'Fly up to Meridian Anchorage and recover the station records. Find out why its fleet beacon went dark.',
   'The records point to Vesper. Travel there and recover the Echo Vault archive: the missing pattern for the fleet beacon.'
  ];return {stage:id,title:contract.title,description:descriptions[i],done:c.completed.includes(contract.target),target:site,contract:id};}),
  {stage:'home',title:'Send the signal home',description:'Return to Mara in Pathfinder Landing on Orison. Give her the archive and bring the fleet beacon online.',done:c.story.finished,target:mara}
 ];
 if(usesShipPurchase(c))chapters.splice(4,0,{stage:'ship-purchase',title:'A ship of your own',description:shipOffer(c).description+' Follow the Northwatch highway to Port Astra City.',done:ownsShip(c),target:HANGAR});
 const index=chapters.findIndex(ch=>!ch.done),chapter=index<0?chapters.at(-1):chapters[index];
 return {id:'main',name:'A Signal Home',title:chapter.title,description:index<0?'The fleet has your signal. The settlements are connected again. Continue exploring and helping the people you meet.':chapter.description,stage:index<0?'complete':chapter.stage,chapter:index<0?chapters.length:index+1,total:chapters.length,target:index<0?null:chapter.target,contract:chapter.contract,complete:index<0};
}
export function advanceStory(c){const quest=mainQuest(c);if(c.story.briefed)for(const id of MAIN_CONTRACTS){const contract=CONTRACTS.find(k=>k.id===id);if(c.completed.includes(contract.target))acceptContract(c,id);}if(quest.contract)acceptContract(c,quest.contract);return quest;}
export function meetPerson(c,id){ensureProgression(c);const person=QUEST_PEOPLE.find(p=>p.id===id);if(!person||!personAvailable(person,c))return false;if(!c.metPeople.includes(id))c.metPeople.push(id);return true;}
export function acceptPersonQuest(c,personId,id){const person=QUEST_PEOPLE.find(p=>p.id===personId);if(!person||!personAvailable(person,c)||!c.metPeople?.includes(personId)||!person.quests.includes(id))return false;return acceptContract(c,id);}
export function speakMain(c){const quest=mainQuest(c);if(quest.stage==='briefing'){c.story.briefed=true;advanceStory(c);return 'briefed';}if(quest.stage==='home'&&!c.story.finished){c.story.finished=true;c.salvage+=300;return 'finished';}return null;}
