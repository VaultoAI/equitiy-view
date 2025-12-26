import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

// Use Next.js API route as proxy to avoid CORS issues
// The old endpoint has been removed - now using The Graph Gateway
const httpLink = createHttpLink({
  uri: typeof window !== 'undefined' ? '/api/graphql' : (process.env.NEXT_PUBLIC_UNISWAP_GRAPHQL_URL || 'https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV'),
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});

