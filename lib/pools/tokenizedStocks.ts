/**
 * Tokenized stocks addresses from Vaulto tokens list
 * These addresses represent tokenized stocks that should be prioritized in pool listings
 */

// Tokenized stock addresses extracted from the Vaulto tokens JSON list
// All addresses are stored in lowercase for case-insensitive matching
const TOKENIZED_STOCK_ADDRESSES = new Set<string>([
  // ChainId 1 (Ethereum Mainnet)
  '0xfedc5f4a6c38211c1338aa411018dfaf26612c08', // SPYon
  '0x62ca254a363dc3c748e7e955c20447ab5bf06ff7', // IVVon
  '0x992651bfeb9a0dcc4457610e284ba66d86489d4d', // TLTon
  '0x0e397938c1aa0680954093495b70a9f5e2249aba', // QQQon
  '0x873d589f38abbcdd1fca27261aba2f1aa0661d44', // SPXUX
  '0xfeff7a377a86462f5a2a872009722c154707f09e', // IEFAon
  '0xff7cf16aa2ffc463b996db2f7b7cf0130336899d', // AGGon
  '0x0692481c369e2bdc728a69ae31b848343a4567be', // ITOTon
  '0x4111b60bc87f2bd1e81e783e271d7f0ec6ee088b', // EFAon
  '0x4f0ca3df1c2e6b943cf82e649d576ffe7b2fabcf', // IAUon
  '0x8d05432c2786e3f93f1a9a62b9572dbf54f3ea06', // IWFon
  '0xcdd60d15125bf3362b6838d2506b0fa33bc1a515', // IEMGon
  '0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4', // SLVon
  '0x77a1a02e4a888ada8620b93c30de8a41e621126c', // EEMon
  '0xf6b1117ec07684d3958cad8beb1b302bfd21103f', // TSLAon
  '0x9dcf7f739b8c0270e2fc0cc8d0dabe355a150dba', // IWNon
  '0x691b126cf619707ed5d16cab1b27c000aa8de300', // LMTon
  '0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee', // NVDAon
  '0xf192957ae52db3eb088654403cc2eded014ae556', // LLYon
  '0x74a03d741226f738098c35da8188e57aca50d146', // KOon
  '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c', // AAPLon
  '0x06954faa913fa14c28eb1b2e459594f22f33f3de', // PFEon
  '0x339ce23a355ed6d513dd3e1462975c4ecd86823a', // PGon
  '0x4c82c8cd9a218612dce60b156b73a36705645e3b', // MCDon
  '0xfd50fc4e3686a8da814c5c3d6121d8ab98a537f0', // IJHon
  '0x070d79021dd7e841123cb0cf554993bf683c511d', // IWMon
  '0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5', // MSFTon
  '0x25d3f236b2d61656eebdea86ac6d42168e340011', // IBMon
  '0x03c1ec4ca9dbb168e6db0def827c085999cbffaf', // JPMon
  '0x3ce219d498d807317f840f4cb0f03fa27dd65046', // PEPon
  '0x28151f5888833d3d767c4d6945a0ee50d1b193e3', // NVOon
  '0x0c1f3412a44ff99e40bf14e06e5ea321ae7b3938', // AMDon
  '0xba47214edd2bb43099611b208f75e4b42fdcfedc', // GOOGLon
  '0xab02fc332e9278ebcbbc6b4a8038050c01d15f69', // TMon
  '0xfda09936dbd717368de0835ba441d9e62069d36f', // INTCon
  '0x82106347ddbb23ce44cf4ce4053ef1adf8b9323b', // WMTon
  '0x7a0f89c1606f71499950aa2590d547c3975b728e', // BLKon
  '0x59644165402b611b350645555b50afb581c71eb2', // METAon
  '0x8f3e41b378ae010c46d255f36bfc1d303b52dceb', // CVXon
  '0x3632dea96a953c11dac2f00b4a05a32cd1063fae', // CRCLon
  '0x980a1001ee94e54142b231f44c7ca7c9df71fbe1', // CSCOon
  '0xac37c20c1d0e5285035e056101a64e263ff94a41', // Von
  '0x3859385363f7bb4dfe42811ccf3f294fcd41dd1d', // ABTon
  '0xf15fbc1349ab99abad63db3f9a510bf413be3bef', // SBUXon
  '0x050362ab1072cb2ce74d74770e22a3203ad04ee5', // MUon
  '0xbb8774fb97436d23d74c1b882e8e9a69322cfd31', // AMZNon
  '0xe51ba774ebf6392c45bf1d9e6b334d07992460d3', // ASMLon
  '0x34bfdff25f0fda6d3ad0c33f1e06c0d40bd68885', // PANWon
  '0x01b19c68f8a9ee3a480da788ba401cfabdf19b93', // LINon
  '0x6cc0afd51ce4cb6920b775f3d6376ab82b9a93bb', // INTUon
  '0x8bcf9012f4b0c1c3d359edb7133c294f82f80790', // NOWon
  '0x4efd92f372898b57f292de69fce377dd7d912bdd', // PYPLon
  '0xd904bcf89b7cedf5c89f9df7e829191d695f847e', // GEon
  '0x2ca12a3f9635fd69c21580def14f25c210ca9612', // SMCIon
  '0x41765f0fcddc276309195166c7a62ae522fa09ef', // BABAon
  '0xaba9ae731aad63335c604e5f6e6a5db2e05f549d', // ACNon
  '0xf404e5f887dbd5508e16a1198fcdd5de1a4296b8', // MRVLon
  '0xd8e26fcc879b30cb0a0b543925a2b3500f074d81', // NKEon
  '0xd08ddb436e731f32455fe302723ee0fd2e9e8706', // PBRon
  '0x73d2ccee12c120e7da265a2de9d9f952a0101b4f', // EQIXon
  '0x9d4c6ad12b55e4645b585209f90cc26614061e91', // BIDUon
  '0x4ad2118da8a65eaa81402a3d583fef6ee76bdf3f', // WFCon
  '0x57270d35a840bc5c094da6fbeca033fb71ea6ab0', // BAon
  '0x5ce215d9c37a195df88e294a06b8396c296b4e15', // FUTUon
  '0x241958c86c7744d15d5f6314ba1ea4c81dda2896', // DASHon
  '0x25018520138bbab60684ad7983d4432e8b8e926b', // CMGon
  '0x3cafdbfe682aec17d5ace2f97a2f3ab3dcf6a4a9', // TSMon
  '0x0d54d4279b9e8c54cd8547c2c75a8ee81a0bcae8', // AVGOon
  '0xb035c3d5083bdc80074f380aebc9fcb68aba0a28', // ABNBon
  '0xa29dc2102dfc2a0a4a5dcb84af984315567c9858', // MAon
  '0x075756f3b6381a79633438faa8964946bf40163d', // UNHon
  '0x0c8276e4fec072cf7854be69c70f7773d1610857', // COSTon
  '0xdeb6b89088ca9b7d7756087c8a0f7c6df46f319c', // JDon
  '0x032dec3372f25c41ea8054b4987a7c4832cdb338', // NFLXon
  '0x3807562a482b824c08a564dfefcc471806d3e00a', // QBTSon
  '0x2bc7ff0c5da9f1a4a51f96e77c5b0f7165dc06d2', // AXPon
  '0xc3d93b45249e8e06cfeb01d25a96337e8893265d', // DISon
  '0x5bcd8195e3ef58f677aef9ebc276b5087c027050', // UBERon
  '0x5bf1b2a808598c0ef4af1673a5457d86fe6d7b3d', // ARMon
  '0x7042a8ffc7c7049684bfbc2fcb41b72380755a43', // ADBEon
  '0xdb57d9c14e357fc01e49035a808779df41e9b4e2', // GSon
  '0xbc843b147db4c7e00721d76037b8b92e13afe13f', // SPGIon
  '0x55720ef5b023fd043ae5f8d2e526030207978950', // CRMon
  '0xed3618bb8778f8ebbe2f241da532227591771d04', // HYGon
  '0x5d1a9a9b118ff19721e0111f094f2360b6ef7a2f', // SNOWon
  '0xe3419710c1f77d44b4dab02316d3f048818c4e59', // QCOMon
  '0x2816169a49953c548bfeb3948dcf05c4a0e4657d', // MELIon
  '0x4d21affd27183b07335935f81a5c26b6a5a15355', // APOon
  '0x8a23c6baadb88512b30475c83df6a63881e33e1e', // ORCLon
  '0x590f21186489ca1612f49a4b1ff5c66acd6796a9', // SPOTon
  '0x0c666485b02f7a87d21add7aeb9f5e64975aa490', // PLTRon
  '0x908266c1192628371cff7ad2f5eba4de061a0ac5', // SHOPon
  '0xa9431d354cfad3c6b76e50f0e73b43d48be80cd0', // RDDTon
  '0xf042cfa86cf1d598a75bdb55c3507a1f39f9493b', // COINon
  '0x998f02a9e343ef6e3e6f28700d5a20f839fd74e6', // HOODon
  '0xcabd955322dfbf94c084929ac5e9eca3feb5556f', // MSTRon
  '0x21deafd91116fce9fe87c8f15bde03f99a309b72', // RIOTon
  '0x073e7a0669833d356fa88ca65cc6d454efaaa3c5', // FIGon
  '0x4604b0b581269843ac7a6b70a5fc019e7762e511', // MARAon
  '0xca468554e5c0423ee858fe3942c9568c51fcaa79', // HIMSon
  '0xd5c5b2883735fa9b658dd52e2fcc8d7c0f1a42ce', // APPon
  '0x71d24baeb0a033ec5f90ff65c4210545af378d97', // GMEon
  '0xfdb46864a7c476f0914c5e82cded3364a9f56f8a', // SBETon
  '0xe5b26ba77e6a4d79a7c54a5296d81254269d9700', // GRNDon
  '0xb7cba7593baafffc96f9bbc86e578026369dec55', // MSon
  '0x1598f7d25d0b0e1261eab9bd2ad7924291eb26bb', // ULon
  '0x85fd8dfd987988ede1777935d9d09c7ac7f09f0b', // CMCSAon
  '0xaf1382692f9927fd6a6c25add60285628a1879e5', // SONYon

  // ChainId 56 (BSC)
  '0x6a708ead771238919d85930b5a0f10454e1c331a', // SPYon
  '0x1104eb7e85e25eb45f88e638b0c27a06c1a91cb2', // IVVon
  '0xf69e40069ac227c11459e3f4e8a446b3401616b6', // TLTon
  '0x0cde6936d305d5b34667fc46425e852efd73559a', // QQQon
  '0x918008c3d29496c37b478b611967beaca365af36', // IEFAon
  '0xcf9caf83053213c44dd7027db3e1e4ac98e55f8f', // ITOTon
  '0x38b9a53bfdc5dba58a29bd6992341927c2fca637', // EFAon
  '0xcb2a0f46f67dc4c58a316f1c008edef5c2311795', // IAUon
  '0x40755f06ab7f8de1ab3a9413b1ef562d63de19b1', // IWFon
  '0x22092c94a91d019ad15536725598b0a6be0a73c0', // IEMGon
  '0x8b872732b07be325a8803cdb480d9d20b6f8d11b', // SLVon
  '0x00c81d35eddf44c75d4db9e07bdcdc236eb0ebcf', // EEMon
  '0xf54b94ea21e1da5d51ef00fd4502225e5394f874', // IWNon
  '0xd09f7b75b9659b864c6f82bb00ff096f9d277998', // LMTon
  '0xa9ee28c80f960b889dfbd1902055218cba016f75', // NVDAon
  '0x341d31b2be1fee9c00e395a62ba41837f4322eed', // LLYon
  '0x405f38b90bebf1259062cf29da299f3398662bcb', // KOon

  // ChainId 10 (Optimism)
  '0x1a149e21bd3e74b7018db79c988b4ba3bbc1873d', // SPXUX

  // ChainId 42161 (Arbitrum)
  '0x4122047076a1106618e984a8776a3f7bbcb1d429', // SPXUX

  // ChainId 8453 (Base)
  '0xfec440fdf48860ff6e2265bd1ef9cae8bb2cce8a', // SPXUX

  // ChainId 43114 (Avalanche)
  '0x1a149e21bd3e74b7018db79c988b4ba3bbc1873d', // SPXUX
]);

/**
 * Checks if a given token address is a tokenized stock
 * @param address - The token address to check (case-insensitive)
 * @returns true if the address is in the tokenized stocks list, false otherwise
 */
export function isTokenizedStock(address: string): boolean {
  if (!address) return false;
  return TOKENIZED_STOCK_ADDRESSES.has(address.toLowerCase());
}

