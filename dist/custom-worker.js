import {simulate} from './engine.js';
self.onmessage=({data})=>{try{
 const parts=data.baseline?2:1,custom=simulate(data.custom.state,data.iterations,data.seed,p=>self.postMessage({progress:p/parts}),data.custom.options);
 const baseline=data.baseline?simulate(data.baseline.state,data.iterations,data.seed,p=>self.postMessage({progress:.5+p/2}),data.baseline.options):null;
 self.postMessage({result:{custom,baseline}});
}catch(e){self.postMessage({error:e.message});}};
