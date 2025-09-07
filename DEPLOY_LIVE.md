# Deploy SentinelX Live on Akash Network

## Prerequisites
1. Install Akash CLI: https://docs.akash.network/guides/cli
2. Create Akash wallet with AKT tokens
3. Fund wallet with at least 5 AKT for deployment

## Quick Deploy Commands

### 1. Create Deployment
```bash
akash tx deployment create akash-deploy.yml --from wallet --chain-id akashnet-2 --node https://rpc.akashnet.net:443 --fees 5000uakt
```

### 2. Find Providers
```bash
akash query market bid list --owner YOUR_WALLET_ADDRESS --node https://rpc.akashnet.net:443
```

### 3. Create Lease
```bash
akash tx market lease create --owner YOUR_WALLET_ADDRESS --dseq DEPLOYMENT_SEQUENCE --gseq 1 --oseq 1 --provider PROVIDER_ADDRESS --from wallet --chain-id akashnet-2 --node https://rpc.akashnet.net:443 --fees 5000uakt
```

### 4. Send Manifest
```bash
akash provider send-manifest akash-deploy.yml --owner YOUR_WALLET_ADDRESS --dseq DEPLOYMENT_SEQUENCE --provider PROVIDER_ADDRESS --home ~/.akash --from wallet
```

### 5. Get Live URL
```bash
akash provider lease-status --owner YOUR_WALLET_ADDRESS --dseq DEPLOYMENT_SEQUENCE --gseq 1 --oseq 1 --provider PROVIDER_ADDRESS --home ~/.akash
```

## Alternative: One-Click Deploy

### Using Akash Console (Easiest)
1. Go to https://console.akash.network
2. Connect wallet
3. Upload `akash-deploy.yml`
4. Click "Deploy"
5. Select provider
6. Get live URL

## Expected Costs
- **Web Service**: ~$5/month
- **API Service**: ~$10/month
- **Total**: ~$15/month (70% cheaper than AWS)

## Live URLs After Deployment
- **Frontend**: `https://YOUR-DEPLOYMENT.provider.akashnet.net`
- **API**: `https://YOUR-DEPLOYMENT.provider.akashnet.net/api`
- **Health Check**: `https://YOUR-DEPLOYMENT.provider.akashnet.net/health`

## Troubleshooting
- If deployment fails, check AKT balance
- Ensure wallet has enough funds for gas fees
- Try different providers if one fails
- Check logs: `akash provider lease-logs`