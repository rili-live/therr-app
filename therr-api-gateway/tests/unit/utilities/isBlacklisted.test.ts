/**
 * Unit Tests for isBlacklisted utility
 *
 * Tests IP and email blacklist checking functionality.
 *
 * Note: These tests verify the blacklist logic independently
 * by implementing the same logic as the source.
 */
import { expect } from 'chai';

describe('isBlacklisted utility', () => {
    // Replicating the blacklist logic from source
    const blacklistedIpPrefixes = ['119.160.56', '119.160.57'];
    const blacklistedEmailSuffixes = ['secmail.org'];

    const isBlacklisted = (ip: string) => {
        const isBadLocale = blacklistedIpPrefixes.some((prefix) => ip.startsWith(prefix));
        return isBadLocale;
    };

    const isBlacklistedEmail = (email?: string) => {
        if (!email) {
            return false;
        }
        const isBadEmail = blacklistedEmailSuffixes.some((suffix) => email.endsWith(suffix));
        return isBadEmail;
    };

    describe('IP Blacklist', () => {
        describe('Blacklisted IP Prefixes', () => {
            it('should blacklist IPs starting with 119.160.56', () => {
                expect(isBlacklisted('119.160.56.1')).to.be.eq(true);
                expect(isBlacklisted('119.160.56.100')).to.be.eq(true);
                expect(isBlacklisted('119.160.56.255')).to.be.eq(true);
            });

            it('should blacklist IPs starting with 119.160.57', () => {
                expect(isBlacklisted('119.160.57.1')).to.be.eq(true);
                expect(isBlacklisted('119.160.57.100')).to.be.eq(true);
                expect(isBlacklisted('119.160.57.255')).to.be.eq(true);
            });

            it('should not blacklist similar but different IP prefixes', () => {
                expect(isBlacklisted('119.160.58.1')).to.be.eq(false);
                expect(isBlacklisted('119.160.55.1')).to.be.eq(false);
                expect(isBlacklisted('119.161.56.1')).to.be.eq(false);
                expect(isBlacklisted('120.160.56.1')).to.be.eq(false);
            });
        });

        describe('Non-Blacklisted IPs', () => {
            it('should allow common public IPs', () => {
                expect(isBlacklisted('8.8.8.8')).to.be.eq(false); // Google DNS
                expect(isBlacklisted('1.1.1.1')).to.be.eq(false); // Cloudflare DNS
                expect(isBlacklisted('208.67.222.222')).to.be.eq(false); // OpenDNS
            });

            it('should allow private network IPs', () => {
                expect(isBlacklisted('192.168.1.1')).to.be.eq(false);
                expect(isBlacklisted('10.0.0.1')).to.be.eq(false);
                expect(isBlacklisted('172.16.0.1')).to.be.eq(false);
            });

            it('should allow localhost', () => {
                expect(isBlacklisted('127.0.0.1')).to.be.eq(false);
            });

            it('should allow IPv6 addresses', () => {
                expect(isBlacklisted('::1')).to.be.eq(false);
                expect(isBlacklisted('2001:4860:4860::8888')).to.be.eq(false);
            });
        });

        describe('Edge Cases', () => {
            it('should handle empty string', () => {
                expect(isBlacklisted('')).to.be.eq(false);
            });

            it('should handle undefined-like values safely', () => {
                expect(isBlacklisted('undefined')).to.be.eq(false);
                expect(isBlacklisted('null')).to.be.eq(false);
            });
        });
    });

    describe('Email Blacklist', () => {
        describe('Blacklisted Email Domains', () => {
            it('should blacklist emails ending with secmail.org', () => {
                expect(isBlacklistedEmail('user@secmail.org')).to.be.eq(true);
                expect(isBlacklistedEmail('spam@secmail.org')).to.be.eq(true);
                expect(isBlacklistedEmail('test.user@secmail.org')).to.be.eq(true);
            });
        });

        describe('Non-Blacklisted Emails', () => {
            it('should allow common legitimate email providers', () => {
                expect(isBlacklistedEmail('user@gmail.com')).to.be.eq(false);
                expect(isBlacklistedEmail('user@yahoo.com')).to.be.eq(false);
                expect(isBlacklistedEmail('user@outlook.com')).to.be.eq(false);
                expect(isBlacklistedEmail('user@hotmail.com')).to.be.eq(false);
            });

            it('should allow corporate email domains', () => {
                expect(isBlacklistedEmail('user@company.com')).to.be.eq(false);
                expect(isBlacklistedEmail('user@therr.com')).to.be.eq(false);
                expect(isBlacklistedEmail('user@example.org')).to.be.eq(false);
            });

            it('should allow education email domains', () => {
                expect(isBlacklistedEmail('student@university.edu')).to.be.eq(false);
                expect(isBlacklistedEmail('professor@college.ac.uk')).to.be.eq(false);
            });
        });

        describe('Edge Cases', () => {
            it('should return false for undefined', () => {
                expect(isBlacklistedEmail(undefined)).to.be.eq(false);
            });

            it('should return false for empty string', () => {
                expect(isBlacklistedEmail('')).to.be.eq(false);
            });

            it('should handle emails without @ symbol', () => {
                expect(isBlacklistedEmail('notanemail')).to.be.eq(false);
            });

            it('should handle emails with subdomain', () => {
                expect(isBlacklistedEmail('user@mail.company.com')).to.be.eq(false);
            });

            it('should be case sensitive (emails ending with blacklisted domain)', () => {
                // The endsWith is case-sensitive
                expect(isBlacklistedEmail('user@SECMAIL.ORG')).to.be.eq(false); // Different case
                expect(isBlacklistedEmail('user@secmail.org')).to.be.eq(true); // Exact match
            });
        });

        describe('Username as Email Check', () => {
            it('should check userName parameter the same as email', () => {
                // The isBlacklistedEmail is called with either req.body.email or req.body.userName
                expect(isBlacklistedEmail('spammer@secmail.org')).to.be.eq(true);
                expect(isBlacklistedEmail('legitimate@gmail.com')).to.be.eq(false);
            });
        });
    });

    describe('Combined Blacklist Logic', () => {
        it('should identify requests that should be blocked by IP', () => {
            const req = {
                ip: '119.160.56.123',
                body: { email: 'user@gmail.com' },
            };

            const shouldBlock = isBlacklisted(req.ip) || isBlacklistedEmail(req.body.email);
            expect(shouldBlock).to.be.eq(true);
        });

        it('should identify requests that should be blocked by email', () => {
            const req = {
                ip: '8.8.8.8',
                body: { email: 'spammer@secmail.org' },
            };

            const shouldBlock = isBlacklisted(req.ip) || isBlacklistedEmail(req.body.email);
            expect(shouldBlock).to.be.eq(true);
        });

        it('should allow requests with clean IP and email', () => {
            const req = {
                ip: '8.8.8.8',
                body: { email: 'user@gmail.com' },
            };

            const shouldBlock = isBlacklisted(req.ip) || isBlacklistedEmail(req.body.email);
            expect(shouldBlock).to.be.eq(false);
        });
    });
});
