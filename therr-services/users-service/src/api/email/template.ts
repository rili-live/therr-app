/* eslint-disable max-len */
import * as globalConfig from '../../../../../global-config';

// Use production images so we can actually load in email
const imagesHost = process.env.NODE_ENV === 'development'
    ? globalConfig.production.hostFull
    : globalConfig[process.env.NODE_ENV].hostFull;

const fontStack = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// TODO: Localize email template
const template = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>{{header}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Light mode defaults (inline styles handle this for most clients) */

    /* Dark mode: Apple Mail, Outlook.com */
    @media (prefers-color-scheme: dark) {
      .body-bg { background-color: {{brandBackgroundHexDark}} !important; }
      .content-bg { background-color: {{contentBgDark}} !important; }
      .text-primary { color: {{textColorDark}} !important; }
      .text-heading { color: #ffffff !important; }
      .text-warning { color: {{warningColorDark}} !important; }
      .btn-accent { background-color: {{brandAccentHexDark}} !important; }
      .btn-accent a { background-color: {{brandAccentHexDark}} !important; border-color: {{brandAccentHexDark}} !important; }
      .text-footer { color: {{footerTextColorLight}} !important; }
      .text-footer a { color: {{footerTextColorLight}} !important; }
    }

    /* Dark mode: Outlook Windows app */
    [data-ogsc] .body-bg { background-color: {{brandBackgroundHexDark}} !important; }
    [data-ogsc] .content-bg { background-color: {{contentBgDark}} !important; }
    [data-ogsc] .text-primary { color: {{textColorDark}} !important; }
    [data-ogsc] .text-heading { color: #ffffff !important; }
    [data-ogsc] .text-warning { color: {{warningColorDark}} !important; }
    [data-ogsc] .btn-accent { background-color: {{brandAccentHexDark}} !important; }
    [data-ogsc] .btn-accent a { background-color: {{brandAccentHexDark}} !important; border-color: {{brandAccentHexDark}} !important; }
    [data-ogsc] .text-footer { color: {{footerTextColorLight}} !important; }
    [data-ogsc] .text-footer a { color: {{footerTextColorLight}} !important; }

    /* Dark mode: Gmail */
    u ~ div .body-bg { background-color: {{brandBackgroundHexDark}} !important; }
    u ~ div .content-bg { background-color: {{contentBgDark}} !important; }
    u ~ div .text-primary { color: {{textColorDark}} !important; }
    u ~ div .text-heading { color: #ffffff !important; }
    u ~ div .text-warning { color: {{warningColorDark}} !important; }
    u ~ div .btn-accent { background-color: {{brandAccentHexDark}} !important; }
    u ~ div .btn-accent a { background-color: {{brandAccentHexDark}} !important; border-color: {{brandAccentHexDark}} !important; }
    u ~ div .text-footer { color: {{footerTextColorLight}} !important; }
    u ~ div .text-footer a { color: {{footerTextColorLight}} !important; }

    /* Mobile responsive */
    @media (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-content { padding: 5px !important; }
      .email-wrapper { padding: 15px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Preheader text (visible in inbox preview, hidden in email body) -->
  {{#if preheaderText}}
  <span style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">{{preheaderText}}</span>
  {{else}}
  <span style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">{{header}}</span>
  {{/if}}
  <span style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>

  <!--[if mso]>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: {{brandBackgroundHexDark}};">
  <tr><td align="center">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="580">
  <tr><td>
  <![endif]-->

  <table border="0" cellpadding="0" cellspacing="0" role="presentation" class="body-bg" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background-color: {{brandBackgroundHexDark}};">
    <tr>
      <td>&nbsp;</td>
      <td class="email-container" style="font-family: ${fontStack}; font-size: 14px; vertical-align: top; display: block; Margin: 0 auto; max-width: 580px; padding: 10px; width: 100%;">

        <!-- Logo -->
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
          <tr>
            <td style="font-family: ${fontStack}; font-size: 14px; vertical-align: top; padding: 20px 10px 10px 30px;">
              <a href="{{homepageLinkUri}}">
                <img src="${imagesHost}/{{logoRelativePath}}" alt="{{logoAltText}}" style="height: 50px; width: 50px; border: 0;" />
              </a>
            </td>
          </tr>
        </table>

        <div class="email-content" style="box-sizing: border-box; display: block; Margin: 0 auto; max-width: 580px; padding: 10px; width: 100%;">

          <!-- START HEADER IMAGE -->
          <div style="clear: both; margin-top: 0px; text-align: center; width: 100%;">
            <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
              <tr>
                <td style="font-family: ${fontStack}; vertical-align: top; padding-bottom: 0px; padding-top: 0px; text-align: center; line-height: 0;">
                  {{#if headerImageRelativePath}}
                    <img src="${imagesHost}/{{headerImageRelativePath}}" alt="E-mail header image" style="height: auto; width: 100%; border: 0;" />
                  {{/if}}
                  {{#unless headerImageRelativePath}}
                    <img src="${imagesHost}/assets/images/email-header.jpg" alt="E-mail header image" style="height: auto; width: 100%; border: 0;" />
                  {{/unless}}
                </td>
              </tr>
            </table>
          </div>
          <!-- END HEADER IMAGE -->

          <!-- START CONTENT AREA -->
          <table class="content-bg" role="presentation" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background: #ffffff;">
            <tr>
              <td class="email-wrapper" style="font-family: ${fontStack}; font-size: 14px; vertical-align: top; box-sizing: border-box; padding: 20px;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                  <tr>
                    <td class="text-primary" style="font-family: ${fontStack}; font-size: 14px; vertical-align: top; color: {{textColorLight}};">
                      <p class="text-heading" style="font-family: ${fontStack}; font-size: 24px; font-weight: bold; margin: 0; Margin-bottom: 15px; text-align: center; color: {{textColorLight}};">{{header}}</p>
                      {{#if dearUser}}
                        <p class="text-primary" style="font-family: ${fontStack}; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px; color: {{textColorLight}};">{{dearUser}}</p>
                      {{/if}}
                      <p class="text-primary" style="font-family: ${fontStack}; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px; color: {{textColorLight}};">{{body1}}</p>
                      {{#if body2}}
                        <p class="text-primary" style="font-family: ${fontStack}; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px; color: {{textColorLight}};">{{body2}}</p>
                      {{/if}}
                      {{#if body3}}
                        <p class="text-primary" style="font-family: ${fontStack}; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px; color: {{textColorLight}};">{{body3}}</p>
                      {{/if}}
                      {{#if bodyBold}}
                      <p class="text-primary" style="font-family: ${fontStack}; font-size: 14px; font-weight: bold; margin: 0; Margin-bottom: 15px; color: {{textColorLight}};">{{bodyBold}}</p>
                      {{/if}}
                      {{#if bodyWarning}}
                      <p class="text-warning" style="font-family: ${fontStack}; font-size: 14px; font-weight: bold; margin: 0; Margin-bottom: 15px; color: {{warningColorLight}};">{{bodyWarning}}</p>
                      {{/if}}
                      {{#if buttonHref}}
                        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; box-sizing: border-box;">
                          <tbody>
                            <tr>
                              <td align="center" style="font-family: ${fontStack}; font-size: 14px; vertical-align: top; padding-bottom: 15px;">
                                <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: auto;">
                                  <tbody>
                                    <tr>
                                      <td class="btn-accent" align="center" style="font-family: ${fontStack}; font-size: 14px; vertical-align: top; background-color: {{brandAccentHex}}; border-radius: 5px; text-align: center;"> <a href="{{buttonHref}}" target="_blank" style="display: inline-block; letter-spacing: .05rem; color: #ffffff; background-color: {{brandAccentHex}}; border: solid 1px {{brandAccentHex}}; border-radius: 5px; box-sizing: border-box; cursor: pointer; text-decoration: none; font-size: 14px; font-weight: bold; margin: 0; padding: 12px 25px; text-transform: capitalize;">{{buttonText}}</a> </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      {{/if}}
                      {{#if postBody1}}
                        <p class="text-primary" style="font-family: ${fontStack}; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 15px; margin-top: 15px; color: {{textColorLight}};">{{postBody1}}</p>
                      {{/if}}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!-- END CONTENT AREA -->

          {{#if footerImageRelativePath}}
            <img src="${imagesHost}/{{footerImageRelativePath}}" alt="E-mail footer image" style="height: auto; width: 100%; border: 0;" />
          {{/if}}

          <!-- START FOOTER -->
          <div style="clear: both; margin-top: 10px; text-align: center; width: 100%;">
            {{#if shouldIncludeSocialIcons}}
              <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tbody>
                  <tr>
                    <td align="center" style="padding: 10px 0;">
                      {{#if socialFacebook}}
                        <a href="{{socialFacebook}}" style="display: inline-block;" target="_blank">
                          <img border="0" src="${imagesHost}/assets/images/social-icons/facebook.png" alt="Facebook" width="48" height="48" style="width: 48px; vertical-align: middle;" />
                        </a>
                      {{/if}}
                      {{#if socialTwitter}}
                        <a href="{{socialTwitter}}" style="display: inline-block;" target="_blank">
                          <img border="0" src="${imagesHost}/assets/images/social-icons/twitter.png" alt="Twitter" width="48" height="48" style="width: 48px; vertical-align: middle;" />
                        </a>
                      {{/if}}
                      {{#if socialInstagram}}
                        <a href="{{socialInstagram}}" style="display: inline-block;" target="_blank">
                          <img border="0" src="${imagesHost}/assets/images/social-icons/instagram.png" alt="Instagram" width="48" height="48" style="width: 48px; vertical-align: middle;" />
                        </a>
                      {{/if}}
                      {{#if socialLinkedin}}
                        <a href="{{socialLinkedin}}" style="display: inline-block;" target="_blank">
                          <img border="0" src="${imagesHost}/assets/images/social-icons/linkedin.png" alt="LinkedIn" width="48" height="48" style="width: 48px; vertical-align: middle;" />
                        </a>
                      {{/if}}
                      {{#if socialYoutube}}
                        <a href="{{socialYoutube}}" style="display: inline-block;" target="_blank">
                          <img border="0" src="${imagesHost}/assets/images/social-icons/youtube.png" alt="YouTube" width="48" height="48" style="width: 48px; vertical-align: middle;" />
                        </a>
                      {{/if}}
                      {{#if socialTiktok}}
                        <a href="{{socialTiktok}}" style="display: inline-block;" target="_blank">
                          <img border="0" src="${imagesHost}/assets/images/social-icons/tiktok.png" alt="TikTok" width="48" height="48" style="width: 48px; vertical-align: middle;" />
                        </a>
                      {{/if}}
                    </td>
                  </tr>
                </tbody>
              </table>
            {{/if}}

            <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
              <tr>
                <td class="text-footer" style="font-family: ${fontStack}; vertical-align: top; padding-bottom: 10px; padding-top: 10px; font-size: 12px; text-align: center; color: {{footerTextColorLight}};">
                  <p style="color: {{footerTextColorLight}}; font-size: 12px; text-align: center; margin: 0; Margin-bottom: 8px;">All rights reserved &copy; <a href="{{homepageLinkUri}}" style="color: {{footerTextColorLight}};">{{legalBusinessName}}</a> {{businessCopyrightYear}}</p>
                  {{#if unsubscribeUrl}}
                  <p style="color: {{footerTextColorLight}}; font-size: 12px; text-align: center; margin: 0;">Not interested in these emails? <a href="{{unsubscribeUrl}}" style="text-decoration: underline; color: {{footerTextColorLight}}; font-size: 12px;">Unsubscribe</a></p>
                  {{/if}}
                  {{#unless unsubscribeUrl}}
                  <p style="color: {{footerTextColorLight}}; font-size: 12px; text-align: center; margin: 0;">Reply "Unsubscribe" to stop receiving {{messageCategory}} e-mails</p>
                  {{/unless}}
                </td>
              </tr>
            </table>
          </div>
          <!-- END FOOTER -->

        </div>
      </td>
      <td>&nbsp;</td>
    </tr>
  </table>

  <!--[if mso]>
  </td></tr></table>
  </td></tr></table>
  <![endif]-->
</body>
</html>`;

export default template;
