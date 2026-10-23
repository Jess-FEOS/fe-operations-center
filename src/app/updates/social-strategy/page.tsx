import {notFound} from 'next/navigation'
import SavedSocialReview from '@/components/SavedSocialReview'
import {reviewEnabled} from '@/lib/saved-review'
export const dynamic='force-dynamic'
export const metadata={title:'Social Strategy review | FE Operations Center',robots:{index:false,follow:false}}
export default function SocialStrategyReview(){
  if(!reviewEnabled(process.env))notFound()
  return <SavedSocialReview />
}
