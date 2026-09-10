import * as React from 'react';
import UsersService from '../services/UsersService';
import { IBrandMembership } from '../types/redux/user';
import { buildHandoffUrl } from '../utilities/handoffClient';

export interface IAccountCenterRenderArgs {
    brandVariations: IBrandMembership[];
    currentBrand: string;
    isHandingOff: boolean;
    handoffError: string | null;
    /**
     * Mint a handoff code for the target brand and invoke the consumer's opener (mobile uses
     * Linking.openURL; web uses window.location.assign). Returns the URL that was opened, or null
     * on failure. Never logs the underlying code.
     */
    openInApp: (targetBrand: string) => Promise<string | null>;
}

export interface IAccountCenterProps {
    brandVariations?: IBrandMembership[];
    currentBrand: string;
    /**
     * Consumer-supplied universal-link opener. Mobile passes Linking.openURL; web passes a wrapper
     * around window.location.assign. Kept out of this component so it stays platform-agnostic.
     */
    openUrl: (url: string) => Promise<void> | void;
    /**
     * Optional. The host the handoff URL is built against (e.g. 'friendswithhabits.com'). When
     * omitted, the URL falls back to therr.com — fine for development; production should pass the
     * niche-specific host so the OS routes the link to the correct installed app via AASA.
     */
    handoffHost?: string;
    children: (args: IAccountCenterRenderArgs) => React.ReactElement | null;
}

/**
 * Headless component for the multi-app Account Center. Owns the handoff state machine; the
 * consumer renders the UI. This keeps the component usable from React Native and web without
 * binding to a particular styling system.
 *
 * Example:
 *
 *   <AccountCenter
 *       brandVariations={user.details.brandVariations}
 *       currentBrand={CURRENT_BRAND_VARIATION}
 *       openUrl={Linking.openURL}
 *   >
 *       {({ brandVariations, openInApp, isHandingOff }) => (
 *           <YourBrandList apps={brandVariations} onOpen={openInApp} loading={isHandingOff} />
 *       )}
 *   </AccountCenter>
 */
const AccountCenter: React.FunctionComponent<IAccountCenterProps> = ({
    brandVariations,
    currentBrand,
    openUrl,
    handoffHost,
    children,
}: IAccountCenterProps) => {
    const [isHandingOff, setIsHandingOff] = React.useState(false);
    const [handoffError, setHandoffError] = React.useState<string | null>(null);

    // Suppress state updates after unmount. The mint→openUrl round trip can outlive the
    // component when the consumer navigates away mid-handoff (mobile in particular: tapping
    // a brand in the Account Center and then backgrounding the app while the request is
    // in flight). React 18 silently discards the stray setState, but guarding here keeps
    // the component honest and behaves identically under React 17.
    //
    // Set to true at the start of every effect run so React 18 strict-mode dev double-invoke
    // (mount → unmount → remount) doesn't leave the ref stuck at false after the strict
    // unmount cycle, which would silently disable every subsequent setState guard.
    const isMountedRef = React.useRef(true);
    React.useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const openInApp = React.useCallback(async (targetBrand: string): Promise<string | null> => {
        if (!targetBrand || targetBrand === currentBrand) return null;
        setIsHandingOff(true);
        setHandoffError(null);
        try {
            const response = await UsersService.mintHandoff(targetBrand);
            const code = response?.data?.code;
            if (!code) {
                if (isMountedRef.current) setHandoffError('handoff_no_code');
                return null;
            }
            const url: string = buildHandoffUrl(code, targetBrand, handoffHost);
            await Promise.resolve(openUrl(url));
            return url;
        } catch (err: any) {
            if (isMountedRef.current) setHandoffError(err?.message || 'handoff_failed');
            return null;
        } finally {
            if (isMountedRef.current) setIsHandingOff(false);
        }
    }, [currentBrand, handoffHost, openUrl]);

    return children({
        brandVariations: brandVariations || [],
        currentBrand,
        isHandingOff,
        handoffError,
        openInApp,
    });
};

export default AccountCenter;
