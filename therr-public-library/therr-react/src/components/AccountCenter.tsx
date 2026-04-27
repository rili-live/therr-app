import * as React from 'react';
import UsersService from '../services/UsersService';
import { IBrandMembership } from '../types/redux/user';

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

    const openInApp = React.useCallback(async (targetBrand: string): Promise<string | null> => {
        if (!targetBrand || targetBrand === currentBrand) return null;
        setIsHandingOff(true);
        setHandoffError(null);
        try {
            const response = await UsersService.mintHandoff(targetBrand);
            const code = response?.data?.code;
            if (!code) {
                setHandoffError('handoff_no_code');
                return null;
            }
            // Inline-imported to avoid creating a cycle at module load when consumers tree-shake.
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            const { buildHandoffUrl } = require('../utilities/handoffClient');
            const url: string = buildHandoffUrl(code, targetBrand, handoffHost);
            await Promise.resolve(openUrl(url));
            return url;
        } catch (err: any) {
            setHandoffError(err?.message || 'handoff_failed');
            return null;
        } finally {
            setIsHandingOff(false);
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
