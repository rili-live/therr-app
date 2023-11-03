/* eslint-disable max-len */
import * as globalConfig from '../../../../../global-config';

// Use production imgaes so we can actually load in email
const imagesHost = process.env.NODE_ENV === 'development'
    ? globalConfig.production.hostFull
    : globalConfig[process.env.NODE_ENV].hostFull;

// TODO: Localize email template
const template = `
  <!-- <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">This is preheader text. Some clients will show this text as a preview.</span> -->
  <table border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background-color: #1C7F8A;">
    <tr>
      <td>&nbsp;</td>
      <td style="font-family: sans-serif; font-size: 14px; vertical-align: top; padding: 20px 10px 0 40px;">
        <a href="${globalConfig[process.env.NODE_ENV].hostFull}">
          <img src="${imagesHost}/assets/images/therr-splash-logo-200.png" alt="Therr logo" style="height: 50px; width: 50px;" />
        </a>
      </td>
      <td>&nbsp;</td>
    </tr>
    <tr>
      <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;">&nbsp;</td>
      <td class="container" style="font-family: sans-serif; font-size: 14px; vertical-align: top; display: block; Margin: 0 auto; max-width: 580px; padding: 10px; width: 580px;">
        <div class="content" style="box-sizing: border-box; display: block; Margin: 0 auto; max-width: 580px; padding: 10px;">

        <!-- START HEADER -->
          <div class="header" style="clear: both; margin-top: 0px; text-align: center; width: 100%;">
            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
              <tr>
                <td class="content-block" style="font-family: sans-serif; vertical-align: top; padding-bottom: 0px; padding-top: 0px; color: #999999; text-align: center; line-height: 0">
                  {{#if headerImageName}}
                    <img src="${imagesHost}/assets/images/{{headerImageName}}" alt="Therr email header" style="height: auto; width: 100%" />
                  {{/if}}
                  {{#unless headerImageName}}
                    <img src="${imagesHost}/assets/images/email-header.jpg" alt="Therr email header" style="height: auto; width: 100%" />
                  {{/unless}}
                </td>
              </tr>
            </table>
          </div>
          <!-- END HEADER -->

          <!-- START CENTERED WHITE CONTAINER -->
          <table class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background: #ffffff;">

            <!-- START MAIN CONTENT AREA -->
            <tr>
              <td class="wrapper" style="font-family: sans-serif; font-size: 14px; vertical-align: top; box-sizing: border-box; padding: 20px;">
                <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                  <tr>
                    <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;">
                      <p style="font-family: sans-serif; font-size: 24px; font-weight: bold; margin: 0; Margin-bottom: 15px; text-align: center;">{{header}}</p>
                      {{#if dearUser}}
                        <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px;">{{dearUser}}</p>
                      {{/if}}
                      <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px;">{{body1}}</p>
                      {{#if body2}}
                        <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px;">{{body2}}</p>
                      {{/if}}
                      {{#if body3}}
                        <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 15px;">{{body3}}</p>
                      {{/if}}
                      {{#if bodyBold}}
                      <p style="font-family: sans-serif; font-size: 14px; font-weight: bold; margin: 0; Margin-bottom: 15px;">{{bodyBold}}</p>
                      {{/if}}
                      {{#if bodyWarning}}
                      <p style="font-family: sans-serif; font-size: 14px; font-weight: bold; margin: 0; Margin-bottom: 15px; color: #ff0000;">{{bodyWarning}}</p>
                      {{/if}}
                      {{#if buttonHref}}
                        <table align="center" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; box-sizing: border-box;">
                          <tbody align="center">
                            <tr align="center">
                              <td align="center" style="font-family: sans-serif; font-size: 14px; vertical-align: top; padding-bottom: 15px;">
                                <table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: auto;">
                                  <tbody align="center">
                                    <tr align="center">
                                      <td align="center" style="font-family: sans-serif; font-size: 14px; vertical-align: top; background-color: #2692c5; border-radius: 5px; text-align: center;"> <a href="{{buttonHref}}" target="_blank" style="display: inline-block; letter-spacing: .05rem; color: #ffffff; background-color: #2692c5; border: solid 1px #2692c5; border-radius: 5px; box-sizing: border-box; cursor: pointer; text-decoration: none; font-size: 14px; font-weight: bold; margin: 0; padding: 12px 25px; text-transform: capitalize; border-color: #3498db;">{{buttonText}}</a> </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      {{/if}}
                      {{#if postBody1}}
                        <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 15px; margin-top: 15px;">{{postBody1}}</p>
                      {{/if}}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          <!-- END MAIN CONTENT AREA -->
          </table>

          <!-- START FOOTER -->
          <div class="footer" style="clear: both; margin-top: 10px; text-align: center; width: 100%;">
            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
            {{#if footerImageName}}
              <img src="${imagesHost}/assets/images/{{footerImageName}}" alt="Therr email footer" style="height: auto; width: 100%" />
            {{/if}}
              <tr>
                <td class="content-block" style="font-family: sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; font-size: 12px; color: #999999; text-align: center;">
                  <span class="apple-link" style="color: #e2e0e0; font-size: 12px; text-align: center;">All rights reserved © Therr Inc. 2021</span>
                  <span class="apple-link" style="color: #e2e0e0; font-size: 12px; text-align: center;">Reply "Unsubscribe" to stop receiving marketing e-mails</span>
                  <!-- <br> Don't like these emails? <a href="https://therr.com" style="text-decoration: underline; color: #999999; font-size: 12px; text-align: center;">Unsubscribe</a>. -->
                </td>
              </tr>
            </table>
          </div>
          <!-- END FOOTER -->

        <!-- END CENTERED WHITE CONTAINER -->
        </div>
      </td>
      <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;">&nbsp;</td>
    </tr>
  </table>
`;

export default template;
