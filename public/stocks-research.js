// Reference values transcribed from the user's attachment, never a live feed.
export const ATTACHMENT_RESEARCH={
  NVDA:{opinion:'買い',target:266.36,diagnosis:'割高',analyst:'割安',
    source:'添付画像',receivedDate:'2026-10-07',publishedAt:null}
};
export function researchColor(value){
  if(['買い','強気買い','強気の買い','割安'].includes(value))return 'orange';
  if(['売り','強気売り','強気の売り','割高'].includes(value))return 'green';
  return 'unknown';
}
