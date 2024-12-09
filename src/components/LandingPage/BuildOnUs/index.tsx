'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { BUILD_ON_US_NOW } from '@/assets'

export default function BuildOnUs() {
    return (
        <div className="relative flex min-h-[72vh] flex-col items-center justify-center overflow-x-hidden bg-pink-1">
            <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, translateY: 20 }}
                whileInView={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 10 }}
            >
                <a
                    href="https://peanutprotocol.notion.site/Integration-Form-12c83811757980869937dcaee9f4b0f0?pvs=4"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <motion.img
                        src={BUILD_ON_US_NOW.src}
                        alt="Build on Peanut Protocol"
                        className="h-auto max-w-[90%] cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                    />
                </a>
            </motion.div>
        </div>
    )
}
