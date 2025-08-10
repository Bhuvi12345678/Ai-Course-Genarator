import { Button } from '@/components/ui/button'
import Image from 'next/image'

import React from 'react'

function Header() {
  
  return (
    <div className='flex justify-between p-10 shadow-sm'>
        <Image src={'/Logo_Main.png'} alt='Logo' width={200} height={200}/>
        <Button className="px-7 py-7 text-lg"><a href="/dashboard">Get Started</a></Button>
    </div>
  )
}

export default Header