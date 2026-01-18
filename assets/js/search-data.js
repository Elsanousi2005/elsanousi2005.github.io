// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "About",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-blog",
          title: "Blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-resume",
          title: "Resume",
          description: "Download my resume as a PDF.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/resume/";
          },
        },{id: "post-post-3-vitis-setup-and-testing-for-ps-ethernet-and-ps-to-pl-validation",
        
          title: "Post 3: Vitis Setup and Testing for PS Ethernet and PS to PL...",
        
        description: "This post covers the Vitis side of the ZC702 bring up. The goal is to validate Ethernet in two layers so that failures are diagnosable rather than ambiguous.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/post-3-vitis-setup-and-testing/";
          
        },
      },{id: "post-post-2-vivado-setup-bitstream-and-hardware-export-xsa",
        
          title: "Post 2: Vivado setup, bitstream, and hardware export (XSA)",
        
        description: "This post documents the Vivado hardware build for the ZC702 Ethernet bring up project. The design has two goals.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/post-2-vivado-setup-bitstream-xsa/";
          
        },
      },{id: "post-post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback",
        
          title: "Post 1: ZC702 PS Ethernet over MIO and PS to PL AXI Loopback...",
        
        description: "Minimal Zynq-7000 bring-up on ZC702 using PS GEM0 Ethernet and a simple PS-to-PL AXI loopback.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/post-1-zc702-ps-ethernet-over-mio-and-ps-to-pl-axi-loopback/";
          
        },
      },{id: "books-the-godfather",
          title: 'The Godfather',
          description: "",
          section: "Books",handler: () => {
              window.location.href = "/books/the_godfather/";
            },},{id: "news-a-simple-inline-announcement",
          title: 'A simple inline announcement.',
          description: "",
          section: "News",},{id: "news-a-long-announcement-with-details",
          title: 'A long announcement with details',
          description: "",
          section: "News",handler: () => {
              window.location.href = "/news/announcement_2/";
            },},{id: "news-a-simple-inline-announcement-with-markdown-emoji-sparkles-smile",
          title: 'A simple inline announcement with Markdown emoji! :sparkles: :smile:',
          description: "",
          section: "News",},{id: "projects-zynq-7000-ethernet-driver",
          title: 'Zynq-7000 Ethernet Driver',
          description: "Bare-metal Ethernet MAC driver with DMA ring management and PHY bring-up for deterministic networking on Zynq-7000.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/10_project/";
            },},{id: "projects-project-1",
          title: 'project 1',
          description: "with background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/1_project/";
            },},{id: "projects-project-2",
          title: 'project 2',
          description: "a project with a background image and giscus comments",
          section: "Projects",handler: () => {
              window.location.href = "/projects/2_project/";
            },},{id: "projects-project-3-with-very-long-name",
          title: 'project 3 with very long name',
          description: "a project that redirects to another website",
          section: "Projects",handler: () => {
              window.location.href = "/projects/3_project/";
            },},{id: "projects-project-4",
          title: 'project 4',
          description: "another without an image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/4_project/";
            },},{id: "projects-project-5",
          title: 'project 5',
          description: "a project with a background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/5_project/";
            },},{id: "projects-project-6",
          title: 'project 6',
          description: "a project with no image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/6_project/";
            },},{id: "projects-project-7",
          title: 'project 7',
          description: "with background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/7_project/";
            },},{id: "projects-project-8",
          title: 'project 8',
          description: "an other project with a background image and giscus comments",
          section: "Projects",handler: () => {
              window.location.href = "/projects/8_project/";
            },},{id: "projects-project-9",
          title: 'project 9',
          description: "another project with an image 🎉",
          section: "Projects",handler: () => {
              window.location.href = "/projects/9_project/";
            },},{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/assets/pdf/Elsanousi_Mostafa_Resume.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%65%6C%73%61%6E%6F%75%73%69%32%30%30%35@%76%74.%65%64%75", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/mostafa-elsanousi", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
