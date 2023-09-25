import * as React from 'react';

interface IPasswordRequirementsProps {
    className: string;
    password: string;
    translate: any;
}

const PasswordRequirements = ({
    className,
    password,
    translate,
}: IPasswordRequirementsProps) => {
    const passwordRequirements1 = translate('pages.register.passwordRequirements1');
    const passwordRequirements2 = translate('pages.register.passwordRequirements2');
    const passwordRequirements3 = translate('pages.register.passwordRequirements3');
    const passwordRequirements4 = translate('pages.register.passwordRequirements4');
    const p1Bullet = /[0-9]/i.test(password) && /[a-z]/i.test(password) ? '✓' : '*';
    const p2Bullet = /[A-Z]/.test(password) ? '✓' : '*';
    const p3Bullet = /[!@#$%^&*]/.test(password) ? '✓' : '*';
    const p4Bullet = password?.length >= 8 ? '✓' : '*';

    return (
        <div className={className}>
            <p className="mb-1 text-underline">
                Password Requirements
            </p>
            <p className="mb-1">
                {`${p1Bullet} ${passwordRequirements1}`}
            </p>
            <p className="mb-1">
                {`${p2Bullet} ${passwordRequirements2}`}
            </p>
            <p className="mb-1">
                {`${p3Bullet} ${passwordRequirements3}`}
            </p>
            <p className="mb-1">
                {`${p4Bullet} ${passwordRequirements4}`}
            </p>
        </div>
    );
};

export default PasswordRequirements;
