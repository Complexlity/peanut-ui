import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAtom } from 'jotai'
import { useAccount, useNetwork } from 'wagmi'
import { switchNetwork, getWalletClient } from '@wagmi/core'
import { providers } from 'ethers'
import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'
import axios from 'axios'
import { isMobile } from 'react-device-detect'
import { Switch } from '@headlessui/react'

import * as store from '@/store'
import * as consts from '@/consts'
import * as _consts from '../send.consts'
import * as utils from '@/utils'
import * as _utils from '../send.utils'
import * as hooks from '@/hooks'
import * as global_components from '@/components/global'
import switch_svg from '@/assets/switch.svg'
import dropdown_svg from '@/assets/dropdown.svg'
import peanut, { interfaces } from '@squirrel-labs/peanut-sdk'

export function SendInitialView({ onNextScreen, setClaimLink, setTxHash, setChainId }: _consts.ISendScreenProps) {
    //hooks
    const { open } = useWeb3Modal()
    const { isConnected, address } = useAccount()
    const { chain: currentChain } = useNetwork()

    //local states
    const [filteredTokenList, setFilteredTokenList] = useState<_consts.ITokenListItem[] | undefined>(undefined)
    const [formHasBeenTouched, setFormHasBeenTouched] = useState(false)
    const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false)
    const [enableConfirmation, setEnableConfirmation] = useState(false)
    const [textFontSize, setTextFontSize] = useState('text-6xl')
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [tokenPrice, setTokenPrice] = useState<number | undefined>(undefined)
    const [inputDenomination, setInputDenomination] = useState<'TOKEN' | 'USD'>('USD')
    const [unfoldChains, setUnfoldChains] = useState(false)
    const [advancedDropdownOpen, setAdvancedDropdownOpen] = useState(false)
    const [showTestnets, setShowTestnets] = useState(false)
    const [showGaslessAvailable, setShowGaslessAvailable] = useState(false)
    const [createGasless, setCreateGasless] = useState(true)
    const verbose = process.env.NODE_ENV === 'development' ? true : false

    //global states
    const [userBalances] = useAtom(store.userBalancesAtom)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [supportedChainsSocketTech] = useAtom(store.supportedChainsSocketTechAtom)
    const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom)
    hooks.useConfirmRefresh(enableConfirmation)

    //form and modalform states
    const sendForm = useForm<_consts.ISendFormData>({
        mode: 'onChange',
        defaultValues: {
            chainId: '1',
            amount: null,
            token: '',
            bulkAmount: undefined,
        },
    })
    const formwatch = sendForm.watch()

    //memo
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const chainsToShow = useMemo(() => {
        if (isConnected && userBalances.length > 0) {
            const filteredChains = chainDetails.filter(
                (chain) => chain.chainId === userBalances.find((balance) => balance.chainId === chain.chainId)?.chainId
            )
            return filteredChains.concat(
                chainDetails.filter(
                    (item1) => !supportedChainsSocketTech.some((item2) => item2.chainId === item1.chainId)
                )
            )
        } else {
            return chainDetails
        }
    }, [isConnected, chainDetails, userBalances, supportedChainsSocketTech])

    const tokenList = useMemo(() => {
        if (isConnected) {
            if (userBalances.some((balance) => balance.chainId == formwatch.chainId)) {
                return userBalances
                    .filter((balance) => balance.chainId == formwatch.chainId)
                    .map((balance) => {
                        return {
                            symbol: balance.symbol,
                            chainId: balance.chainId,
                            amount: balance.amount,
                            address: balance.address,
                            decimals: balance.decimals,
                            logo: balance.logoURI,
                            name: balance.name,
                        }
                    })
            } else {
                return (
                    tokenDetails
                        .find((tokendetail) => tokendetail.chainId == formwatch.chainId.toString())
                        ?.tokens.map((token) => {
                            return {
                                symbol: token.symbol,
                                chainId: formwatch.chainId,
                                amount: 0,
                                address: token.address,
                                decimals: token.decimals,
                                logo: token.logoURI,
                                name: token.name,
                            }
                        }) ?? []
                )
            }
        } else {
            return chainDetails
                .filter((chain) => chain.chainId == formwatch.chainId)
                .map((chain) => {
                    return {
                        symbol: chain.nativeCurrency.symbol,
                        chainId: chain.chainId.toString(),
                        amount: 0,
                        address: '',
                        decimals: 18,
                        logo: '',
                        name: chain.nativeCurrency.name,
                    }
                })
        }
    }, [isConnected, userBalances, tokenDetails, formwatch.chainId, chainDetails])

    const getWalletClientAndUpdateSigner = async ({
        chainId,
    }: {
        chainId: string
    }): Promise<providers.JsonRpcSigner> => {
        const walletClient = await getWalletClient({ chainId: Number(chainId) })
        if (!walletClient) {
            throw new Error('Failed to get wallet client')
        }
        const signer = utils.walletClientToSigner(walletClient)
        return signer
    }

    const fetchTokenPrice = async (tokenAddress: string, chainId: string) => {
        try {
            const response = await axios.get('https://api.socket.tech/v2/token-price', {
                params: {
                    tokenAddress: tokenAddress,
                    chainId: chainId,
                },
                headers: {
                    accept: 'application/json',
                    'API-KEY': process.env.SOCKET_API_KEY,
                },
            })
            setTokenPrice(response.data.result.tokenPrice)
            return Number(response.data.result.tokenPrice)
        } catch (error) {
            console.log('error fetching token price for token ' + tokenAddress)
            setTokenPrice(undefined)
            setInputDenomination('TOKEN')
        }
    }

    const checkForm = (sendFormData: _consts.ISendFormData, signer: providers.JsonRpcSigner | undefined) => {
        //check that the token and chainid are defined
        if (sendFormData.chainId == null || sendFormData.token == '') {
            setErrorState({
                showError: true,
                errorMessage: 'Please select a chain and token',
            })
            return { succes: 'false' }
        }

        //check if the amount is less than or equal to zero
        if (!sendFormData.amount || (sendFormData.amount && Number(sendFormData.amount) <= 0)) {
            setErrorState({
                showError: true,
                errorMessage: 'Please put an amount that is greater than zero',
            })
            return { succes: 'false' }
        }

        if (advancedDropdownOpen && !Number.isInteger(sendFormData.bulkAmount)) {
            setErrorState({
                showError: true,
                errorMessage: 'Please define a non-decimal number of links',
            })
            return { succes: 'false' }
        }

        if (!signer) {
            getWalletClientAndUpdateSigner({ chainId: sendFormData.chainId })
            setErrorState({
                showError: true,
                errorMessage: 'Signer undefined, please try again',
            })

            return { succes: 'false' }
        }

        //check if the bulkAmount is less than or equal to zero when bulk is selected
        if (sendFormData.bulkAmount && sendFormData.bulkAmount <= 0 && advancedDropdownOpen) {
            setErrorState({
                showError: true,
                errorMessage: 'If you want to bulk send, please input an amount of links you want to have created',
            })

            return { succes: 'false' }
        }

        return { succes: 'true' }
    }

    const calculateTokenAmount = async (
        sendFormData: _consts.ISendFormData
    ): Promise<{ tokenAmount: number; status: string }> => {
        if (inputDenomination == 'USD') {
            var price: number | undefined = undefined
            try {
                price = await fetchTokenPrice(
                    tokenList.find((token) => token.symbol == sendFormData.token)?.address ?? '',
                    sendFormData.chainId
                )
            } catch (error) {
                console.error(error)
                setErrorState({
                    showError: true,
                    errorMessage:
                        'Something went wrong while fetching the token price, please change input denomination',
                })
                return { tokenAmount: 0, status: 'ERROR' }
            }

            if (price) {
                if (advancedDropdownOpen) {
                    return {
                        tokenAmount: (Number(sendFormData.amount) * (sendFormData.bulkAmount ?? 0)) / price,
                        status: 'SUCCESS',
                    }
                } else {
                    return { tokenAmount: Number(sendFormData.amount) / price, status: 'SUCCESS' }
                }
            } else {
                return { tokenAmount: 0, status: 'ERROR' }
            }
        } else {
            return { tokenAmount: Number(sendFormData.amount) ?? 0, status: 'SUCCESS' }
        }
    }

    const checkNetwork = async (chainId: string) => {
        //check if the user is on the correct chain
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingStates('allow network switch')

            await utils.waitForPromise(switchNetwork({ chainId: Number(chainId) })).catch((error) => {
                setErrorState({
                    showError: true,
                    errorMessage: 'Something went wrong while switching networks',
                })
                setLoadingStates('idle')
                throw error
            })
            setLoadingStates('switching network')
            isMobile && (await new Promise((resolve) => setTimeout(resolve, 4000))) // wait a sec after switching chain before making other deeplink
            setLoadingStates('loading')
        }
    }

    const isGaslessDepositPossible = ({
        tokenAddress,
        latestContractVersion,
        chainId,
    }: {
        tokenAddress: string
        latestContractVersion?: string
        chainId: string
    }) => {
        if (latestContractVersion == undefined)
            latestContractVersion = peanut.getLatestContractVersion({
                chainId: chainId,
                type: 'normal',
                experimental: true,
            })
        if (
            _utils.toLowerCaseKeys(peanut.EIP3009Tokens[chainId as keyof typeof peanut.EIP3009Tokens])[
                tokenAddress.toLowerCase()
            ] &&
            latestContractVersion == peanut.LATEST_EXPERIMENTAL_CONTRACT_VERSION
        ) {
            return true
        } else {
            return false
        }
    }

    const createLink = useCallback(
        async (sendFormData: _consts.ISendFormData) => {
            try {
                if (isLoading) return
                setLoadingStates('checking inputs')
                setErrorState({
                    showError: false,
                    errorMessage: '',
                })

                //Get the signer
                const signer = await getWalletClientAndUpdateSigner({ chainId: sendFormData.chainId })

                //check if the formdata is correct
                if (checkForm(sendFormData, signer).succes === 'false') {
                    return
                }
                setEnableConfirmation(true)

                //Calculate the token amount
                const { tokenAmount, status } = await calculateTokenAmount(sendFormData)
                if (status == 'ERROR') {
                    setErrorState({
                        showError: true,
                        errorMessage: 'Something went wrong while calculating the token amount',
                    })
                    return
                }

                //get the token details
                const { tokenAddress, tokenDecimals, tokenType } = _utils.getTokenDetails(
                    sendFormData,
                    userBalances,
                    tokenDetails,
                    chainsToShow
                )

                console.log(
                    (advancedDropdownOpen ? 'bulk ' : 'solo ') +
                        'sending ' +
                        tokenAmount +
                        ' ' +
                        sendFormData.token +
                        ' on chain with id ' +
                        sendFormData.chainId +
                        ' with token address: ' +
                        tokenAddress +
                        ' with tokenType: ' +
                        tokenType +
                        ' with tokenDecimals: ' +
                        tokenDecimals
                )

                await checkNetwork(sendFormData.chainId)

                //when the user tries to refresh, show an alert
                setEnableConfirmation(true)

                const passwords = await Promise.all(
                    Array.from({ length: advancedDropdownOpen ? sendFormData.bulkAmount ?? 1 : 1 }, async () =>
                        peanut.getRandomString(16)
                    )
                )

                const linkDetails = {
                    chainId: sendFormData.chainId,
                    tokenAmount: parseFloat(tokenAmount.toFixed(6)),
                    tokenType: tokenType,
                    tokenAddress: tokenAddress,
                    tokenDecimals: tokenDecimals,
                    baseUrl: window.location.origin + '/claim',
                    trackId: 'ui',
                }

                setLoadingStates('preparing transaction')

                let getLinksFromTxResponse
                let txHash: string
                const currentDateTime = new Date()
                const tempLocalstorageKey =
                    'saving temp link without depositindex for address: ' + address + ' at ' + currentDateTime

                const latestContractVersion = peanut.getLatestContractVersion({
                    chainId: sendFormData.chainId.toString(),
                    type: 'normal',
                    experimental: true,
                })

                if (
                    isGaslessDepositPossible({ tokenAddress, latestContractVersion, chainId: sendFormData.chainId }) &&
                    createGasless
                ) {
                    verbose && console.log('creating gaslessly')

                    const { payload, message } = await peanut.makeGaslessDepositPayload({
                        linkDetails,
                        password: passwords[0],
                        contractVersion: peanut.LATEST_EXPERIMENTAL_CONTRACT_VERSION,
                        address: address ?? '',
                    })

                    verbose && console.log('makeGaslessDepositPayload result: ', { payload }, { message })

                    setLoadingStates('sign in wallet')

                    const userDepositSignature = await signer._signTypedData(
                        message.domain,
                        message.types,
                        message.values
                    )

                    verbose && console.log('Signature:', userDepositSignature)

                    setLoadingStates('executing transaction')

                    const response = await peanut.makeDepositGasless({
                        APIKey: process.env.PEANUT_API_KEY ?? '',
                        payload,
                        signature: userDepositSignature,
                        baseUrl: `${consts.peanut_api_url}/deposit-3009`,
                    })

                    passwords.map((password, idx) => {
                        const tempLink =
                            '/claim?c=' +
                            linkDetails.chainId +
                            '&v=' +
                            latestContractVersion +
                            '&i=?&p=' +
                            password +
                            '&t=ui'
                        utils.saveToLocalStorage(tempLocalstorageKey + ' - ' + idx, tempLink)
                    })

                    verbose && console.log('makeDepositGasless response: ', response)

                    setLoadingStates('creating link')

                    await signer.provider.waitForTransaction(response.txHash)

                    getLinksFromTxResponse = await peanut.getLinksFromTx({
                        linkDetails,
                        txHash: response.txHash,
                        passwords: passwords,
                    })

                    txHash = response.txHash
                } else {
                    verbose && console.log('not creating gaslessly')

                    const prepareTxsResponse = await peanut.prepareTxs({
                        address: address ?? '',
                        linkDetails,
                        passwords: passwords,
                        numberOfLinks: advancedDropdownOpen ? sendFormData.bulkAmount : undefined,
                        batcherContractVersion: advancedDropdownOpen ? latestContractVersion : undefined,
                        peanutContractVersion: advancedDropdownOpen ? undefined : latestContractVersion,
                    })

                    passwords.map((password, idx) => {
                        const tempLink =
                            '/claim?c=' +
                            linkDetails.chainId +
                            '&v=' +
                            latestContractVersion +
                            '&i=?&p=' +
                            password +
                            '&t=ui'
                        utils.saveToLocalStorage(tempLocalstorageKey + ' - ' + idx, tempLink)
                    })

                    const signedTxsResponse: interfaces.ISignAndSubmitTxResponse[] = []

                    for (const tx of prepareTxsResponse.unsignedTxs) {
                        setLoadingStates('sign in wallet')
                        const x = await peanut.signAndSubmitTx({
                            structSigner: {
                                signer: signer,
                            },
                            unsignedTx: tx,
                        })
                        isMobile && (await new Promise((resolve) => setTimeout(resolve, 2000))) // wait 2 seconds

                        setLoadingStates('executing transaction')
                        await x.tx.wait()
                        signedTxsResponse.push(x)
                    }

                    setLoadingStates(advancedDropdownOpen ? 'creating links' : 'creating link')

                    getLinksFromTxResponse = await peanut.getLinksFromTx({
                        linkDetails,
                        txHash: signedTxsResponse[signedTxsResponse.length - 1].txHash,
                        passwords: passwords,
                    })

                    txHash = signedTxsResponse[signedTxsResponse.length - 1].txHash
                }

                verbose && console.log('Created links:', getLinksFromTxResponse.links)
                verbose && console.log('Transaction hash:', txHash)

                passwords.map((password, idx) => {
                    utils.delteFromLocalStorage(tempLocalstorageKey + ' - ' + idx)
                })

                getLinksFromTxResponse.links.forEach((link, index) => {
                    utils.saveToLocalStorage(address + ' - ' + txHash + ' - ' + index, link)
                })

                setClaimLink(getLinksFromTxResponse.links)
                setTxHash(txHash)
                setChainId(sendFormData.chainId)
                onNextScreen()
            } catch (error: any) {
                console.error(error)
                if (error instanceof peanut.interfaces.SDKStatus && !error.originalError) {
                    const errorMessage = utils.sdkErrorHandler(error)
                    setErrorState({
                        showError: true,
                        errorMessage: errorMessage,
                    })
                } else {
                    console.error(error)
                    if (error.toString().includes('insufficient funds')) {
                        setErrorState({
                            showError: true,
                            errorMessage: "You don't have enough funds",
                        })
                    } else if (error.toString().includes('user rejected transaction')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please confirm the transaction in your wallet',
                        })
                    } else if (error.toString().includes('not deployed on chain')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Bulk is not able on this chain, please try another chain',
                        })
                    } else if (error.toString().includes('User rejected the request')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Please allow the network switch in your wallet',
                        })
                    } else if (error.toString().includes('NETWORK_ERROR')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'A network error occured. Please refresh and try again',
                        })
                    } else if (error.toString().includes('NONCE_EXPIRED')) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Nonce expired, please try again',
                        })
                    } else {
                        setErrorState({
                            showError: true,
                            errorMessage: 'Something failed while creating your link. Please try again',
                        })
                    }
                }
            } finally {
                setLoadingStates('idle')
                setEnableConfirmation(false)
            }
        },
        [
            currentChain,
            userBalances,
            onNextScreen,
            isLoading,
            address,
            inputDenomination,
            tokenPrice,
            advancedDropdownOpen,
        ]
    )

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    //update the errormessage when the walletAddress has been changed
    useEffect(() => {
        setErrorState({
            showError: false,
            errorMessage: '',
        })
    }, [address])

    //when the token has changed, fetch the tokenprice and display it
    useEffect(() => {
        if (!isConnected) setTokenPrice(undefined)
        else if (formwatch.token && formwatch.chainId) {
            const tokenAddress = tokenList.find((token) => token.symbol == formwatch.token)?.address ?? undefined
            if (tokenAddress) {
                if (isGaslessDepositPossible({ tokenAddress, chainId: formwatch.chainId })) {
                    setShowGaslessAvailable(true)
                } else {
                    setShowGaslessAvailable(false)
                }
                if (tokenAddress == '0x0000000000000000000000000000000000000000') {
                    fetchTokenPrice('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', formwatch.chainId)
                } else {
                    fetchTokenPrice(tokenAddress, formwatch.chainId)
                }
            }
        }
        if (formwatch.token) {
        }
    }, [formwatch.token, formwatch.chainId, isConnected])

    useEffect(() => {
        //update the chain and token when the user changes the chain in the wallet
        if (
            currentChain &&
            currentChain?.id.toString() != formwatch.chainId &&
            !formHasBeenTouched &&
            chainDetails.some((chain) => chain.chainId == currentChain.id)
        ) {
            sendForm.setValue(
                'token',
                chainDetails.find((chain) => chain.chainId == currentChain.id)?.nativeCurrency.symbol ?? ''
            )
            sendForm.setValue('chainId', currentChain.id.toString())
        } else if (chainsToShow.length > 0 && !formHasBeenTouched) {
            sendForm.setValue('chainId', chainsToShow[0].chainId)
            sendForm.setValue('token', chainsToShow[0].nativeCurrency.symbol)
        }
    }, [currentChain, chainDetails, chainsToShow, formHasBeenTouched, isConnected])

    return (
        <>
            <div className="flex w-full flex-col items-center text-center  sm:mb-3">
                <h2 className="title-font bold text-2xl lg:text-4xl">Red Packet</h2>
                <div className="w-4/5 font-normal">
                    A red envelope or red packet is a gift of money given during holidays.
                </div>
            </div>
            <form className="w-full" onSubmit={sendForm.handleSubmit(createLink)}>
                <div className="flex w-full flex-col items-center gap-0 sm:gap-5">
                    <div className="flex w-full flex-col items-center justify-center gap-6 p-4 ">
                        <div
                            className=" flex h-[58px] w-[136px] cursor-pointer flex-col gap-2 border-4 border-solid !px-8 !py-1"
                            onClick={() => {
                                if (isConnected && chainsToShow.length <= 0) {
                                    setErrorState({
                                        showError: true,
                                        errorMessage: 'No funds available',
                                    })
                                } else {
                                    setIsTokenSelectorOpen(true)
                                }
                            }}
                        >
                            {isConnected ? (
                                chainsToShow.length > 0 ? (
                                    <div className="flex cursor-pointer flex-col items-center justify-center">
                                        <label className="self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                            {chainDetails.find((chain) => chain.chainId == formwatch.chainId)?.name}
                                        </label>{' '}
                                        <label className=" self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                            {formwatch.token}
                                        </label>
                                    </div>
                                ) : (
                                    <label className="flex h-full items-center justify-center text-sm font-bold">
                                        No funds available
                                    </label>
                                )
                            ) : (
                                <div className="flex cursor-pointer flex-col items-center justify-center">
                                    <label className="self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-sm font-bold">
                                        {chainDetails.find((chain) => chain.chainId == formwatch.chainId)?.name}
                                    </label>{' '}
                                    <label className=" self-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                        {formwatch.token}
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className=" flex h-[58px] w-[224px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                            <div className="font-normal">Total Amount</div>
                            <div className="flex flex-row items-center justify-between">
                                <input className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent text-xl font-bold outline-none" />

                                <div className="items-center text-xs font-normal">$...</div>
                            </div>
                        </div>
                        <div className=" flex h-[58px] w-[224px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                            <div className="font-normal">№ of Recipients</div>
                            <div className="flex flex-row items-center justify-between">
                                <div className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all text-xl font-bold">
                                    12
                                </div>
                                <div className="items-center text-xs font-normal">$2.69 fee</div>
                            </div>
                        </div>
                    </div>
                    <div
                        className={
                            errorState.showError || showGaslessAvailable
                                ? 'mx-auto mb-0 mt-4 flex w-full flex-col items-center gap-10 sm:mt-0'
                                : 'mx-auto mb-8 mt-4 flex w-full flex-col items-center sm:mt-0'
                        }
                    >
                        <button
                            type={isConnected ? 'submit' : 'button'}
                            className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                            id="cta-btn"
                            onClick={() => {
                                if (!isConnected) {
                                    open()
                                }
                            }}
                            disabled={isLoading ? true : false}
                        >
                            {isLoading ? (
                                <div className="flex justify-center gap-1">
                                    <label>{loadingStates} </label>
                                    <span className="bouncing-dots flex">
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                    </span>
                                </div>
                            ) : !isConnected ? (
                                'Connect Wallet'
                            ) : (
                                'Create'
                            )}
                        </button>
                        {errorState.showError ? (
                            <div className="text-center">
                                <label className="font-bold text-red ">{errorState.errorMessage}</label>
                            </div>
                        ) : (
                            showGaslessAvailable && (
                                <div className="flex flex-row items-center justify-center gap-1 text-center">
                                    <label className="font-bold text-black ">
                                        Uncheck this box if you don't want to create a link gaslessly
                                    </label>
                                    <input
                                        type="checkbox"
                                        className="m-0 mt-1 h-5 rounded-none p-0 accent-black"
                                        checked={createGasless}
                                        onChange={() => setCreateGasless(!createGasless)}
                                    />
                                </div>
                            )
                        )}
                    </div>
                </div>
            </form>

            <global_components.PeanutMan type="presenting" />
            <Transition.Root show={isTokenSelectorOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setFormHasBeenTouched(true)
                        setIsTokenSelectorOpen(false)
                        setUnfoldChains(false)
                        setFilteredTokenList(undefined)
                    }}
                >
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full min-w-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative min-h-[240px] w-full transform overflow-hidden rounded-lg rounded-none bg-white pt-5 text-left text-black shadow-xl transition-all sm:mt-8 sm:min-h-[380px] sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="mb-8 flex items-center justify-center sm:hidden">
                                        <svg width="128" height="6">
                                            <rect width="128" height="6" />
                                        </svg>
                                    </div>
                                    <div className="mb-8 ml-4 mr-4 sm:mb-2">
                                        <div
                                            className={
                                                'flex  w-full flex-wrap gap-2 overflow-hidden text-black ' +
                                                (unfoldChains ? ' max-h-full ' : ' max-h-32 ')
                                            }
                                        >
                                            {chainsToShow.map((chain) =>
                                                !showTestnets ? (
                                                    chain.mainnet && (
                                                        <div
                                                            key={chain.chainId}
                                                            className={
                                                                'brutalborder flex h-full w-1/5 min-w-max grow cursor-pointer flex-row gap-2 px-2 py-1 sm:w-[12%] ' +
                                                                (formwatch.chainId == chain.chainId
                                                                    ? 'bg-black text-white'
                                                                    : '')
                                                            }
                                                            onClick={() => {
                                                                sendForm.setValue('chainId', chain.chainId)
                                                                sendForm.setValue('token', chain.nativeCurrency.symbol)
                                                                setFormHasBeenTouched(true)
                                                            }}
                                                        >
                                                            <img src={chain.icon.url} className="h-6 cursor-pointer" />

                                                            <label className="flex cursor-pointer items-center">
                                                                {chain.name.toUpperCase()}
                                                            </label>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div
                                                        key={chain.chainId}
                                                        className={
                                                            'brutalborder flex h-full w-1/5 min-w-max grow cursor-pointer flex-row gap-2 px-2 py-1 sm:w-[12%] ' +
                                                            (formwatch.chainId == chain.chainId
                                                                ? 'bg-black text-white'
                                                                : '')
                                                        }
                                                        onClick={() => {
                                                            sendForm.setValue('chainId', chain.chainId)
                                                            sendForm.setValue('token', chain.nativeCurrency.symbol)
                                                            setFormHasBeenTouched(true)
                                                        }}
                                                    >
                                                        <img src={chain.icon.url} className="h-6 cursor-pointer" />

                                                        <label className="flex cursor-pointer items-center">
                                                            {chain.name.toUpperCase()}
                                                        </label>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <div className="flex w-full justify-between">
                                            <div className=" cursor-pointer ">
                                                <img
                                                    style={{
                                                        transform: unfoldChains ? 'scaleY(-1)' : 'none',
                                                        transition: 'transform 0.3s ease-in-out',
                                                    }}
                                                    src={dropdown_svg.src}
                                                    alt=""
                                                    className={'h-9 '}
                                                    onClick={() => {
                                                        console.log('unfolded chains')

                                                        setUnfoldChains(!unfoldChains)
                                                    }}
                                                />
                                            </div>

                                            <Switch.Group as="div" className="flex items-center p-0">
                                                <Switch
                                                    checked={showTestnets}
                                                    onChange={setShowTestnets}
                                                    className={classNames(
                                                        showTestnets ? 'bg-teal' : 'bg-gray-200',
                                                        'relative m-0 inline-flex h-4 w-9 flex-shrink-0 cursor-pointer rounded-none border-2 border-black p-0 transition-colors duration-200 ease-in-out '
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={classNames(
                                                            showTestnets ? 'translate-x-5' : 'translate-x-0',
                                                            'pointer-events-none m-0 inline-block h-3 w-3 transform rounded-none border-2 border-black bg-white shadow ring-0 transition duration-200 ease-in-out'
                                                        )}
                                                    />
                                                </Switch>
                                                <Switch.Label as="span" className="ml-3">
                                                    <span className="text-sm">show testnets</span>
                                                </Switch.Label>
                                            </Switch.Group>
                                        </div>
                                    </div>

                                    <div className="mb-8 ml-4 mr-4 sm:mb-4">
                                        <input
                                            placeholder="Search"
                                            className="brutalborder w-full rounded-none px-1 py-2 text-lg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal"
                                            onKeyUp={(e) => {
                                                //@ts-ignore
                                                const searchValue = e.target.value
                                                if (searchValue == '') {
                                                    setFilteredTokenList(undefined)
                                                } else {
                                                    setFilteredTokenList(
                                                        tokenList.filter((token) =>
                                                            token.name.toLowerCase().includes(searchValue.toLowerCase())
                                                        )
                                                    )
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="brutalscroll flex max-h-64 min-h-32 flex-col overflow-auto	 overflow-x-hidden  sm:mt-2 ">
                                        {filteredTokenList
                                            ? filteredTokenList.map((token) => (
                                                  <div
                                                      key={token.address}
                                                      className={
                                                          'flex cursor-pointer flex-row justify-between px-2 py-2  ' +
                                                          (formwatch.token == token.symbol
                                                              ? ' bg-black text-white'
                                                              : '')
                                                      }
                                                      onClick={() => {
                                                          sendForm.setValue('token', token.symbol)
                                                          sendForm.setValue('chainId', token.chainId)
                                                          setFormHasBeenTouched(true)
                                                          setIsTokenSelectorOpen(false)
                                                          setUnfoldChains(false)
                                                          setFilteredTokenList(undefined)
                                                      }}
                                                  >
                                                      <div className="flex items-center gap-2 ">
                                                          <img src={token.logo} className="h-6" loading="eager" />
                                                          <div>{token.name}</div>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <div>
                                                              {token.amount > 0 &&
                                                                  utils.formatTokenAmount(token.amount)}
                                                          </div>{' '}
                                                          <div>{token.symbol}</div>
                                                      </div>
                                                  </div>
                                              ))
                                            : tokenList.map((token) => (
                                                  <div
                                                      key={token.address}
                                                      className={
                                                          'flex cursor-pointer flex-row justify-between px-2 py-2  ' +
                                                          (formwatch.token == token.symbol
                                                              ? ' bg-black text-white'
                                                              : '')
                                                      }
                                                      onClick={() => {
                                                          setFormHasBeenTouched(true)
                                                          setIsTokenSelectorOpen(false)
                                                          setUnfoldChains(false)
                                                          setFilteredTokenList(undefined)
                                                          sendForm.setValue('token', token.symbol)
                                                          sendForm.setValue('chainId', token.chainId)
                                                      }}
                                                  >
                                                      <div className="flex items-center gap-2 ">
                                                          <img src={token.logo} className="h-6" loading="eager" />
                                                          <div>{token.name}</div>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <div>
                                                              {token.amount > 0 &&
                                                                  utils.formatTokenAmount(token.amount)}
                                                          </div>{' '}
                                                          <div>{token.symbol}</div>
                                                      </div>
                                                  </div>
                                              ))}
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        </>
    )
}