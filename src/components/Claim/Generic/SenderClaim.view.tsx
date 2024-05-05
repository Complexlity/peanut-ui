'use client'
import Icon from '@/components/Global/Icon'

import * as _consts from '../Claim.consts'
import * as context from '@/context'
import * as utils from '@/utils'
import { useRouter } from 'next/navigation'
import { useContext, useState } from 'react'
import useClaimLink from '../useClaimLink'
import { useAccount } from 'wagmi'
import * as interfaces from '@/interfaces'
import Loading from '@/components/Global/Loading'

interface ISenderClaimLinkViewProps {
    changeToRecipientView: () => void
    claimLinkData: interfaces.ILinkDetails | undefined
    setTransactionHash: (hash: string) => void
    onCustom: (screen: _consts.ClaimScreens) => void
}

export const SenderClaimLinkView = ({
    changeToRecipientView,
    claimLinkData,
    setTransactionHash,
    onCustom,
}: ISenderClaimLinkViewProps) => {
    const { claimLink } = useClaimLink()
    const { isConnected, address } = useAccount()

    const router = useRouter()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const handleOnCancel = async () => {
        setLoadingState('loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })
        console.log('claimLinkData', claimLinkData)

        if (!claimLinkData) return

        try {
            setLoadingState('executing transaction')
            const claimTxHash = await claimLink({
                address: address ?? '',
                link: claimLinkData.link,
            })

            console.log('claimTxHash', claimTxHash)

            if (claimTxHash) {
                changeToRecipientView()
                setTransactionHash(claimTxHash)
                onCustom('SUCCESS')
            } else {
                throw new Error('Error claiming link')
            }
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('idle')
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Hello, creator!</label>
            <label className="text-h8 font-bold ">
                This is a link that you have created. You can cancel it to reclaim the funds or go to the recipient
                view.
            </label>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button className="btn-purple btn-xl" onClick={handleOnCancel} disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Cancel'
                    )}
                </button>
                <button
                    className="btn btn-xl dark:border-white dark:text-white"
                    onClick={changeToRecipientView}
                    disabled={isLoading}
                >
                    Go to recipient view
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
            <label className="text-h9 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a
                    className="cursor-pointer text-black underline dark:text-white"
                    target="_blank"
                    href="https://discord.gg/BX9Ak7AW28"
                >
                    Discord!
                </a>
            </label>
            <div className="absolute bottom-0 -mb-0.5 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border border-black border-n-1 bg-purple-3  px-4.5 dark:text-black">
                <div
                    className="cursor-pointer border border-n-1 p-0 px-1"
                    onClick={() => {
                        router.push('/dashboard')
                    }}
                >
                    <Icon name="like" className="-mt-0.5" />
                </div>
                <label className=" text-sm font-bold">Check out all the links you have created</label>
            </div>
        </div>
    )
}

export default SenderClaimLinkView