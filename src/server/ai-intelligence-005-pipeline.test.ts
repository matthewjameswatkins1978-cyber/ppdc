import assert from "node:assert/strict";
import test from "node:test";
import { extractDealFromIntake } from "../domain/extract-text.js";
import { assessDeal } from "../domain/assessment.js";
import { runEvidencePipeline } from "./ai-intelligence-005-pipeline.js";
import { GeminiEvidenceProvider } from "./gemini-evidence-provider-005.js";
import type { ModelProvider, ProviderRequest, SourceInput } from "../domain/ai-intelligence-005.js";

test("two distinct roles run sequentially; adviser receives reconciled excerpts, not raw listing",async()=>{
 const text="Seller requests PayPal Friends & Family for this item purchase.";
 const source:SourceInput={id:"P-payment",field:"payment_terms",text,order:0};
 const deal=assessDeal(extractDealFromIntake({dealId:"AI005-pipeline",segments:[{id:source.id,field:source.field,text}]}));
 const roles:string[]=[],inputs:Record<string,unknown>[]=[];
 const mock:ModelProvider={id:"mock",async generate(request:ProviderRequest){
  roles.push(request.role);inputs.push(request.input as Record<string,unknown>);
  if(request.role==="evidence-auditor")return{content:JSON.stringify({proposals:[],uncertainties:["No additional correction."]}),usage:{inputTokens:10,outputTokens:3}};
  const input=request.input as any;assert.ok(input.validatedEvidence.length>0);assert.equal(input.originalSources,undefined);
  const cite={evidenceId:source.id,quote:text,startOffset:0,endOffset:text.length};
  return{content:JSON.stringify({summary:"Seller requests PayPal Friends & Family for this item purchase.",summaryEvidence:[cite],points:[],questions:[],unresolved:[]}),usage:{inputTokens:12,outputTokens:5}};
 }};
 const result=await runEvidencePipeline(deal,[source],mock,[]);
 assert.deepEqual(roles,["evidence-auditor","deal-sense-adviser"]);
 assert.ok(inputs[0]!.originalSources);
 assert.equal(inputs[1]!.originalSources,undefined);
 assert.ok(result.final.findings.some(f=>f.ruleId==="friends-family-purchase"));
 assert.equal(result.usage.length,2);
 assert.ok((result.adviser.output?.combinedQuestions.length??0)<=4);assert.ok(result.adviser.output?.combinedQuestions.some(q=>/Goods & Services/.test(q)));
});

test("Gemini adapter emits documented medium thinking and JSON schema without a network call",async()=>{
 let capturedUrl="",capturedInit:RequestInit|undefined;
 const provider=new GeminiEvidenceProvider("synthetic-test-key",async(input,init)=>{
  capturedUrl=String(input);capturedInit=init;
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"proposals":[],"uncertainties":[]}' }]}}],usageMetadata:{promptTokenCount:21,candidatesTokenCount:8,thoughtsTokenCount:4}}),{status:200,headers:{"content-type":"application/json"}});
 });
 const result=await provider.generate({role:"evidence-auditor",system:"auditor",input:{synthetic:true},responseSchema:{type:"object"},reasoning:"medium"});
 const body=JSON.parse(String(capturedInit?.body));
 assert.match(capturedUrl,/gemini-3\.8-flash:generateContent$/);
 assert.equal(capturedUrl.includes("synthetic-test-key"),false);
 assert.equal((capturedInit?.headers as Record<string,string>)["x-goog-api-key"],"synthetic-test-key");
 assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,"MEDIUM");
 assert.equal(body.generationConfig.responseMimeType,"application/json");
 assert.deepEqual(body.generationConfig.responseSchema,{type:"object"});
 assert.equal(result.usage?.inputTokens,21);
 assert.equal(result.usage?.reasoningTokens,4);
});
