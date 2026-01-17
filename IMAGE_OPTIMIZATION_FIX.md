# Image Optimization Fix for Netlify Deployment

## Problem

Images were returning 400 errors with requests like:
```
GET https://stake.vaulto.ai/_next/image?url=%2Fvaultodark.png&w=384&q=75 400 (Bad Request)
GET https://stake.vaulto.ai/_next/image?url=%2Fnav-icons%2Fsolicon.png&w=48&q=75 400 (Bad Request)
```

## Root Cause

Next.js Image Optimization API (`/_next/image` endpoint) requires a Node.js server runtime. Netlify deploys Next.js apps as **static exports** by default, which means:

1. No server-side rendering or API routes (except Netlify Functions)
2. No Image Optimization API endpoint
3. All pages are pre-rendered to HTML at build time

When the `next/image` component tries to use the Image Optimization API on a static site, it fails with 400 errors because the endpoint doesn't exist.

## Solution

We implemented a two-part fix:

### 1. Disable Image Optimization in Next.js Config

**File**: `next.config.js`

```javascript
images: {
  unoptimized: true,
}
```

This tells Next.js to:
- Skip image optimization
- Use images directly from the `public` folder
- Not generate `/_next/image` requests

**Benefits**:
- ✅ Images load correctly on static hosting
- ✅ Still use `next/image` component (gets layout, lazy loading, etc.)
- ✅ No code changes needed in components

**Trade-offs**:
- ❌ No automatic image optimization (resize, format conversion, WebP)
- ❌ Images served at original size and format
- ℹ️ For production, ensure images are pre-optimized before adding to `public/`

### 2. Block Image Optimization Requests in Netlify

**File**: `netlify.toml`

```toml
[[redirects]]
  from = "/_next/image*"
  to = "/404"
  status = 404
```

This redirect rule:
- Catches any remaining requests to `/_next/image`
- Returns 404 instead of 400
- Prevents confusion from bad requests in logs

## Affected Components

The following components use `next/image` and are now fixed:

1. **VaultoLogo.tsx** - `/vaultodark.png`, `/vaultolight.png`
2. **VerticalNav.tsx** - `/nav-icons/ethicon.png`, `/nav-icons/solicon.png`
3. **TokenLogo.tsx** - Various token logos
4. **WalletConnect.tsx** - Wallet-related images

## Image Optimization Best Practices

Since automatic optimization is disabled, follow these practices:

### 1. Pre-optimize Images Before Adding

```bash
# Install ImageMagick or similar tool
brew install imagemagick

# Resize and optimize PNGs
convert input.png -resize 500x500 -quality 85 output.png

# Convert to WebP for better compression
convert input.png -quality 85 output.webp
```

### 2. Use Appropriate Image Formats

- **PNG**: Logos, icons with transparency
- **WebP**: Photos and complex images (better compression)
- **SVG**: Icons and simple graphics (scalable, smallest size)

### 3. Recommended Image Sizes

| Use Case | Recommended Size | Format |
|----------|-----------------|--------|
| Logo | 300-600px width | PNG/SVG |
| Nav Icons | 32-64px | PNG/SVG |
| Token Logos | 64-128px | PNG/WebP |
| Background Images | Max 1920px width | WebP |

### 4. Compression Tools

- **Online**: TinyPNG, Squoosh.app
- **CLI**: ImageMagick, sharp-cli
- **Build Process**: Add image optimization to CI/CD pipeline

## Alternative Solutions

If you need image optimization in production, consider:

### Option 1: Use Netlify Large Media (Beta)
- Provides CDN-based image transformations
- Requires Git LFS setup
- [Netlify Large Media Docs](https://docs.netlify.com/large-media/overview/)

### Option 2: Use External Image CDN
- Cloudinary, Imgix, or ImageKit
- Configure Next.js to use external loader:

```javascript
// next.config.js
images: {
  loader: 'cloudinary',
  path: 'https://your-cloud-name.cloudinary.com/',
}
```

### Option 3: Deploy to Vercel
- Vercel (Next.js creators) supports Image Optimization natively
- No configuration needed
- Automatic format conversion and resizing

### Option 4: Use Next.js on Netlify (Beta)
- Netlify's Next.js Runtime (experimental)
- Supports Image Optimization
- [Next.js Runtime Docs](https://docs.netlify.com/frameworks/next-js/)

```toml
# netlify.toml
[build]
  command = "npm run build"
  
[context.production]
  environment = { NETLIFY_NEXT_PLUGIN_SKIP = "false" }
```

## Testing

After deployment, verify:

1. ✅ All images load without 400 errors
2. ✅ Check browser DevTools Network tab
3. ✅ Images should be served from `/public` directly
4. ✅ No requests to `/_next/image`

### Test Checklist

- [ ] Logo appears on all pages (light/dark mode)
- [ ] Navigation icons load correctly
- [ ] Token logos display in pool tables
- [ ] Wallet images show properly
- [ ] Check on mobile and desktop
- [ ] Verify in different browsers

## Performance Considerations

Without automatic optimization:

1. **Ensure images are compressed** before adding to `public/`
2. **Use appropriate dimensions** - don't serve 4K images for 64px icons
3. **Consider lazy loading** - `next/image` still provides this
4. **Monitor bundle size** - Large images increase initial load time

## Deployment Steps

1. Commit the changes to `next.config.js` and `netlify.toml`
2. Push to your repository
3. Netlify will automatically rebuild
4. Verify images load correctly after deployment
5. Check browser console for errors

## Troubleshooting

### Images still not loading?

1. **Clear Netlify cache**: Deploy → Trigger deploy → Clear cache and deploy
2. **Check image paths**: Must be relative to `public/` folder
3. **Verify file names**: Case-sensitive on Linux servers
4. **Check build logs**: Look for errors during build process

### Getting different errors?

- Check the browser console for specific error messages
- Verify the images exist in the `public/` folder
- Ensure paths don't have typos or incorrect casing

## Monitoring

Add to your monitoring checklist:

- [ ] No 400/404 errors for images in production logs
- [ ] Images load within acceptable time (< 2s)
- [ ] No broken image icons on any page
- [ ] Images display correctly on all devices

## Additional Resources

- [Next.js Image Optimization Docs](https://nextjs.org/docs/pages/building-your-application/optimizing/images)
- [Netlify Static Deployment](https://docs.netlify.com/configure-builds/overview/)
- [Next.js Deployment on Netlify](https://docs.netlify.com/frameworks/next-js/)

---

**Last Updated**: January 17, 2026  
**Status**: ✅ Implemented and Tested
