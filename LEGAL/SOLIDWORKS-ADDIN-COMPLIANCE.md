# NavoBase SOLIDWORKS add-in commercialization checklist

1. Use documented, supported SOLIDWORKS APIs only. Do not depend on undocumented
   interfaces/functions.
2. Build the add-in in C#/.NET against the official SOLIDWORKS primary interop
   assemblies. For installation, use the official redistributable interop
   assemblies supplied in the SOLIDWORKS API redist location when redistribution
   is needed and permitted by the installed product/license.
3. The customer must own a valid supported SOLIDWORKS license. NavoBase does not
   provide a SOLIDWORKS license.
4. NavoFlo licensing must license only NavoFlo's code/features. Do not attempt to
   bypass, extend, emulate or interfere with SOLIDWORKS licensing/entitlements.
5. Keep the add-in product name NavoFlo/NavoBase. Do not put `SOLIDWORKS` in the
   product name/domain in a manner suggesting ownership/endorsement.
6. Do not use SOLIDWORKS partner/certification logos unless NavoFlo has actually
   been accepted/authorized under the applicable partner program.
7. Consider applying to the SOLIDWORKS Solution Partner Program before broad
   commercial launch, especially if you want official partner entitlement keys,
   certification, logos or marketplace positioning.
8. Ship a NavoBase EULA plus third-party notices in the installer/About dialog.
9. Sign the installer/add-in binaries with a code-signing certificate.
10. Publish supported SOLIDWORKS versions and a compatibility/update policy.
11. If mapping executes user-defined actions/scripts, document permissions and
    sandbox/validation rules. Do not run arbitrary downloaded code silently.
12. Keep licensing calls independent from CAD contents: no part/drawing/model
    upload, filename, path or geometry in entitlement requests.

Trademark notice for marketing/docs:

> SOLIDWORKS is a trademark of Dassault Systèmes SolidWorks Corporation or its
> affiliates. NavoFlo is an independent product and is not affiliated with or
> endorsed by Dassault Systèmes unless expressly stated under a written partner
> agreement.

## Canadian software-installation consent (CASL / LCAP)

Prefer a user-initiated installer/update flow. Canadian CASL guidance distinguishes
self-installed software from software that a business installs or causes to be
installed on another person's device. For any pushed/background installation or
update that falls within CASL, obtain the required consent and keep evidence of
it. Clearly identify NavoFlo, explain the program's function/purpose and disclose
unexpected functions separately where required. Do not silently install extra
software or collect unexpected device/CAD data as part of the add-in installer.
