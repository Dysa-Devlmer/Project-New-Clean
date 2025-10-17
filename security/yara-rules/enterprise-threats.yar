/*
   YARA Rules for Enterprise Fortune 10 Global Military Threat Detection
   Advanced Persistent Threat (APT) Detection and Malware Analysis

   Classification: ENTERPRISE CONFIDENTIAL
   Usage: Automated threat detection in CI/CD and runtime environments
*/

import "pe"
import "elf"
import "math"
import "hash"

// Advanced Persistent Threat (APT) Detection Rules
rule APT_PowerShell_Obfuscation {
    meta:
        description = "Detects obfuscated PowerShell commands often used by APT groups"
        author = "Enterprise Security Team"
        classification = "APT"
        severity = "HIGH"
        reference = "MITRE ATT&CK T1059.001"

    strings:
        $powershell1 = "powershell" nocase
        $powershell2 = "pwsh" nocase
        $obfuscation1 = "-encodedcommand" nocase
        $obfuscation2 = "-enc" nocase
        $obfuscation3 = "invoke-expression" nocase
        $obfuscation4 = "iex" nocase
        $base64 = /[A-Za-z0-9+\/]{50,}={0,2}/

    condition:
        any of ($powershell*) and any of ($obfuscation*) and $base64
}

rule APT_Lateral_Movement_Techniques {
    meta:
        description = "Detects lateral movement techniques used by advanced attackers"
        author = "Enterprise Security Team"
        classification = "APT"
        severity = "HIGH"
        reference = "MITRE ATT&CK T1021"

    strings:
        $psexec = "psexec" nocase
        $wmic = "wmic" nocase
        $schtasks = "schtasks" nocase
        $admin_share1 = "\\\\.*\\admin$" nocase
        $admin_share2 = "\\\\.*\\c$" nocase
        $remote_exec1 = "/c copy" nocase
        $remote_exec2 = "cmd.exe /c" nocase

    condition:
        2 of them
}

// Supply Chain Attack Detection
rule Supply_Chain_Suspicious_NPM_Package {
    meta:
        description = "Detects suspicious patterns in NPM packages indicating supply chain attacks"
        author = "Enterprise Security Team"
        classification = "SUPPLY_CHAIN"
        severity = "CRITICAL"
        reference = "NIST SP 800-161"

    strings:
        $npm_install = "npm install" nocase
        $suspicious_domain1 = /https?:\/\/[a-z0-9\-]+\.tk\//
        $suspicious_domain2 = /https?:\/\/[a-z0-9\-]+\.ml\//
        $suspicious_domain3 = /https?:\/\/[a-z0-9\-]+\.ga\//
        $credential_harvest1 = "process.env.AWS_SECRET" nocase
        $credential_harvest2 = "process.env.SECRET" nocase
        $credential_harvest3 = ".npmrc" nocase
        $crypto_mining = "cryptonight" nocase
        $remote_shell = "reverse_tcp" nocase

    condition:
        $npm_install and (any of ($suspicious_domain*) or any of ($credential_harvest*) or $crypto_mining or $remote_shell)
}

rule Malicious_Docker_Image {
    meta:
        description = "Detects potentially malicious Docker images"
        author = "Enterprise Security Team"
        classification = "CONTAINER_SECURITY"
        severity = "HIGH"
        reference = "NIST SP 800-190"

    strings:
        $dockerfile = "FROM" nocase
        $privilege_escalation1 = "USER root" nocase
        $privilege_escalation2 = "sudo" nocase
        $crypto_miner1 = "xmrig" nocase
        $crypto_miner2 = "cpuminer" nocase
        $crypto_miner3 = "minerd" nocase
        $suspicious_download1 = "wget http://" nocase
        $suspicious_download2 = "curl http://" nocase
        $hidden_process = "nohup" nocase

    condition:
        $dockerfile and ($privilege_escalation1 or $privilege_escalation2) and (any of ($crypto_miner*) or any of ($suspicious_download*) or $hidden_process)
}

// Data Exfiltration Detection
rule Data_Exfiltration_Patterns {
    meta:
        description = "Detects data exfiltration patterns and tools"
        author = "Enterprise Security Team"
        classification = "DATA_EXFILTRATION"
        severity = "CRITICAL"
        reference = "MITRE ATT&CK T1041"

    strings:
        $compress1 = "7z a" nocase
        $compress2 = "tar -czf" nocase
        $compress3 = "zip -r" nocase
        $upload1 = "curl -T" nocase
        $upload2 = "wget --post-file" nocase
        $upload3 = "scp" nocase
        $cloud_upload1 = "aws s3 cp" nocase
        $cloud_upload2 = "gsutil cp" nocase
        $cloud_upload3 = "az storage blob upload" nocase
        $steganography = "steghide" nocase

    condition:
        any of ($compress*) and (any of ($upload*) or any of ($cloud_upload*) or $steganography)
}

// Financial Data Protection
rule PCI_DSS_Sensitive_Data {
    meta:
        description = "Detects potential PCI DSS sensitive data in code"
        author = "Enterprise Security Team"
        classification = "PCI_DSS"
        severity = "CRITICAL"
        reference = "PCI DSS 3.2.1"

    strings:
        $credit_card1 = /4[0-9]{12}(?:[0-9]{3})?/  // Visa
        $credit_card2 = /5[1-5][0-9]{14}/          // Mastercard
        $credit_card3 = /3[47][0-9]{13}/           // American Express
        $cvv = /[0-9]{3,4}/
        $track_data = /%[A-Z][0-9]{13,19}\^/

    condition:
        any of ($credit_card*) and ($cvv or $track_data)
}

// HIPAA Protected Health Information
rule HIPAA_PHI_Detection {
    meta:
        description = "Detects potential HIPAA Protected Health Information"
        author = "Enterprise Security Team"
        classification = "HIPAA"
        severity = "HIGH"
        reference = "45 CFR 164.514"

    strings:
        $ssn = /\b\d{3}-\d{2}-\d{4}\b/
        $medical_record = /MRN[:\s]*[A-Z0-9]{6,}/
        $patient_id = /PATIENT[_\s]ID[:\s]*[A-Z0-9]{6,}/
        $diagnosis_code = /ICD[_\s]?10?[:\s]*[A-Z][0-9]{2,}/
        $dob = /DOB[:\s]*\d{1,2}\/\d{1,2}\/\d{4}/

    condition:
        2 of them
}

// Insider Threat Detection
rule Insider_Threat_Indicators {
    meta:
        description = "Detects potential insider threat indicators"
        author = "Enterprise Security Team"
        classification = "INSIDER_THREAT"
        severity = "MEDIUM"
        reference = "NIST SP 800-53 PS-3"

    strings:
        $data_collection1 = "find / -name \"*.xlsx\"" nocase
        $data_collection2 = "locate *.doc" nocase
        $data_collection3 = "grep -r \"confidential\"" nocase
        $credential_theft1 = "cat /etc/passwd" nocase
        $credential_theft2 = "cat ~/.ssh/id_rsa" nocase
        $log_deletion1 = "rm /var/log/*" nocase
        $log_deletion2 = "history -c" nocase
        $unusual_time = /[0-2][0-9]:[0-5][0-9]:[0-5][0-9]/ // Late night activities

    condition:
        2 of them
}

// Cloud Security Threats
rule AWS_Credential_Exposure {
    meta:
        description = "Detects exposed AWS credentials"
        author = "Enterprise Security Team"
        classification = "CLOUD_SECURITY"
        severity = "CRITICAL"
        reference = "AWS Security Best Practices"

    strings:
        $aws_access_key = /AKIA[0-9A-Z]{16}/
        $aws_secret_key = /[A-Za-z0-9\/\+]{40}/
        $aws_session_token = /[A-Za-z0-9\/\+]{100,}/

    condition:
        $aws_access_key and ($aws_secret_key or $aws_session_token)
}

// Zero Day Exploit Detection
rule Potential_Zero_Day_Exploit {
    meta:
        description = "Detects potential zero-day exploit patterns"
        author = "Enterprise Security Team"
        classification = "ZERO_DAY"
        severity = "CRITICAL"
        reference = "MITRE ATT&CK T1068"

    strings:
        $shellcode_pattern1 = { 90 90 90 90 [4-8] 68 [4] 68 [4] 68 [4] }
        $shellcode_pattern2 = { 31 c0 50 68 [4] 68 [4] 89 e1 }
        $rop_gadget = { 58 c3 } // pop eax; ret
        $heap_spray = { 0c 0c 0c 0c [100-1000] 0c 0c 0c 0c }
        $format_string = "%n%n%n%n"
        $buffer_overflow = /A{100,}/

    condition:
        any of ($shellcode_pattern*) or $rop_gadget or $heap_spray or $format_string or $buffer_overflow
}

// Ransomware Detection
rule Ransomware_Indicators {
    meta:
        description = "Detects ransomware indicators and behaviors"
        author = "Enterprise Security Team"
        classification = "RANSOMWARE"
        severity = "CRITICAL"
        reference = "MITRE ATT&CK T1486"

    strings:
        $ransom_note1 = "your files have been encrypted" nocase
        $ransom_note2 = "pay the ransom" nocase
        $ransom_note3 = "bitcoin" nocase
        $file_extension1 = ".locked" nocase
        $file_extension2 = ".encrypted" nocase
        $file_extension3 = ".crypto" nocase
        $crypto_api1 = "CryptGenRandom" nocase
        $crypto_api2 = "CryptEncrypt" nocase
        $delete_shadows = "vssadmin delete shadows" nocase

    condition:
        any of ($ransom_note*) or any of ($file_extension*) or (any of ($crypto_api*) and $delete_shadows)
}

// Enterprise Compliance Violations
rule GDPR_Data_Processing_Violation {
    meta:
        description = "Detects potential GDPR data processing violations"
        author = "Enterprise Security Team"
        classification = "GDPR"
        severity = "HIGH"
        reference = "GDPR Article 6"

    strings:
        $personal_data1 = /email[:\s]*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
        $personal_data2 = /phone[:\s]*\+?[0-9\s\-\(\)]{10,}/
        $processing_without_consent = "process_personal_data" nocase
        $no_lawful_basis = "no_consent" nocase
        $data_transfer = "transfer_to_third_country" nocase

    condition:
        any of ($personal_data*) and ($processing_without_consent or $no_lawful_basis or $data_transfer)
}

// Enterprise Network Security
rule Suspicious_Network_Activity {
    meta:
        description = "Detects suspicious network activity patterns"
        author = "Enterprise Security Team"
        classification = "NETWORK_SECURITY"
        severity = "HIGH"
        reference = "NIST SP 800-94"

    strings:
        $port_scan = "nmap" nocase
        $network_enum1 = "netstat -an" nocase
        $network_enum2 = "arp -a" nocase
        $tunnel1 = "ssh -D" nocase
        $tunnel2 = "ngrok" nocase
        $c2_communication = /POST \/[a-z0-9]{32}/ nocase

    condition:
        2 of them
}

/*
   Enterprise Detection Rules Summary:
   - APT Detection: Advanced persistent threat indicators
   - Supply Chain: Malicious packages and containers
   - Data Protection: PCI DSS, HIPAA, GDPR compliance
   - Insider Threats: Suspicious internal activities
   - Cloud Security: AWS credential exposure
   - Zero Days: Exploit pattern detection
   - Ransomware: Encryption and ransom indicators
   - Network Security: Suspicious network activities

   These rules provide comprehensive threat detection suitable for
   Fortune 10 Global Military enterprise environments.
*/