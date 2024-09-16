import '@/styles/globals.css'
import { Roboto_Flex, Londrina_Solid } from 'next/font/google'
import { ColorModeScript, ColorModeProvider } from '@chakra-ui/color-mode'
<<<<<<< HEAD
import * as config from '@/config'
import * as context from '@/context'
import CrispChat from '../components/CrispChat'
=======
import { PeanutProvider } from '@/config'
import { ContextProvider } from '@/config'
import Head from 'next/head'
>>>>>>> 3495f4ff (Updated components and pages to integrate the styling from the new club landing page. Have added some styling classes to the global.css)

const roboto = Roboto_Flex({
    weight: ['400', '500', '700', '800'],
    subsets: ['latin'],
    display: 'block',
    variable: '--font-roboto',
})

const londrina = Londrina_Solid({
    weight: ['400', '900'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-londrina',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${roboto.variable} ${londrina.variable} chakra-ui-light font-sans`}>
                <ColorModeProvider>
                    <ColorModeScript
                        initialColorMode="light"
                        key="chakra-ui-no-flash"
                        storageKey="chakra-ui-color-mode"
                    />
                    <config.PeanutProvider>
                        <context.ContextProvider>
                            {children}
                            <CrispChat />
                        </context.ContextProvider>
                    </config.PeanutProvider>
                </ColorModeProvider>
            </body>
        </html>
    )
}
